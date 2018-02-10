'use strict';

const amqp            = require('amqplib');
const Promise         = require('bluebird');
const AMQPPosterError = require('./AMQPPosterError');


class AMQPPoster {
	constructor (options) {
		this.options = {
			server:    options.server,
			name:      options.name,
			prefetch:  Number(options.prefetch) || 1,
			subscribe: options.subscribe
		};

		this.pendingPromiseFuncs = {}; // Hash for promise's resolve/reject functions

		this.assertedExchanges = []; // Cache for publish exchanges which was already asserted

		this.connection     = undefined;
		this.channel        = undefined;
		this.subscribeQueue = undefined;
		this.answerQueue    = undefined;
		this.queue          = undefined;
	}

	/**
	 * Init RPC. Start queue for incoming messages (optional), start queue for answers
	 * @returns {Promise.<void>}
	 */
	init () {
		return Promise.resolve()
		.then(() => { // Create connection
			return amqp.connect(this.options.server);
		})
		.then((connection) => { // Create channel
			this.connection = connection;

			return this.connection.createChannel();
		})
		.then((channel) => {
			this.channel = channel;
			this.channel.prefetch(this.options.prefetch);

			if (this.options.subscribe) {
				this.channel.assertExchange(this.options.subscribe, 'fanout', {durable: true});

				return this.channel.assertQueue('', {exclusive: true})
				.then((queue) => {
					this.subscribeQueue = queue;

					this.channel.bindQueue(this.subscribeQueue.queue, this.options.subscribe, '');
				});
			}
		})
		.then(() => { // Assert main income queue
			if (this.options.name) {
				return this.channel.assertQueue(this.options.name, {durable: true})
				.then((queue) => {
					this.queue = queue;
				});
			}
		})
		.then(() => { // Assert queue for answers
			return this.channel.assertQueue('', {exclusive: true});
		})
		.then((queue) => { // Handler for answer's queue
			this.answerQueue = queue;

			this.channel.consume(this.answerQueue.queue, (message) => {
				/**
				 *  There we get response for request
				 */

				let funcsObj = this.pendingPromiseFuncs[message.properties.correlationId];
				delete this.pendingPromiseFuncs[message.properties.correlationId];

				if (!funcsObj) {
					return;
				}

				return Promise.resolve()
				.then(() => {
					return AMQPPoster.processContent(message);
				})
				.then(funcsObj.resolve)
				.catch(funcsObj.reject);
			}, {noAck: true});
		});
	}

	/**
	 * Send message to queue. Return promise with answer
	 * @param to
	 * @param reqObj
	 * @returns {Promise.<void>}
	 */
	send (to, reqObj) {
		let correlationId = process.pid + '_' + process.hrtime().join('');

		return Promise.resolve()
		.then(() => {
			let data = Buffer.from(JSON.stringify({data: reqObj}));
			let properties = {
				contentType:     'application/json',
				contentEncoding: 'utf8',
				replyTo:         this.answerQueue.queue,
				timestamp:       Date.now(),
				correlationId:   correlationId,
				persistent:      true,
			};

			return this.channel.sendToQueue(to, data, properties);
		})
		.then((result) => {
			if (!result) {
				throw new AMQPPosterError('Can not send now');
			}

			// Trick for fulfil/reject promise only when we get answer for request
			return new Promise((resolve, reject) => {
				this.pendingPromiseFuncs[correlationId] = {
					resolve: resolve,
					reject:  reject
				};
			});
		});
	}

	/**
	 * Set handler for incoming messages from main income queue
	 * @param handler
	 * @returns {Promise.<void>}
	 */
	setMessageHandler (handler) {
		return Promise.resolve()
		.then(() => {
			this.channel.consume(this.queue.queue, (message) => {
				let content = AMQPPoster.processContent(message);

				return Promise.resolve()
				.then(() => {
					return handler(content);
				})
				.then((answer) => {
					return Buffer.from(JSON.stringify({data: answer === undefined ? '' : answer}));
				})
				.catch((err) => {
					if (err instanceof Error) {
						let errObj = {};

						Object.getOwnPropertyNames(err).forEach((k) => {
							errObj[k] = err[k];
						});

						return Buffer.from(JSON.stringify({error: errObj}));
					}

					return Buffer.from(JSON.stringify({error: err}));
				})
				.then((data) => {
					let to = message.properties.replyTo;
					let properties = {
						contentType:     'application/json',
						contentEncoding: 'utf8',
						replyTo:         null,
						timestamp:       Date.now(),
						correlationId:   message.properties.correlationId,
						persistent:      true,
					};

					this.channel.sendToQueue(to, data, properties);

					return this.channel.ack(message);
				});
			}, {noAck: false});
		});
	}


	/**
	 * Publish messages
	 * @param to
	 * @param dataObj
	 * @returns {Promise<void>}
	 */
	publish (to, dataObj) {
		if (!this.assertedExchanges.includes(to)) {
			this.channel.assertExchange(to, 'fanout', {durable: true});
			this.assertedExchanges.push(to);
		}

		let correlationId = process.pid + '_' + process.hrtime().join('');

		return Promise.resolve()
		.then(() => {
			let data = Buffer.from(JSON.stringify(dataObj));
			let properties = {
				contentType:     'application/json',
				contentEncoding: 'utf8',
				timestamp:       Date.now(),
				correlationId:   correlationId,
				persistent:      true,
			};

			return this.channel.publish(to, '', data, properties);
		});
	}

	/**
	 * Set handler for broadcasting messages from subscribed exchange
	 * @param handler
	 * @returns {Promise<void>}
	 */
	setBroadcastHandler (handler) {
		return Promise.resolve()
		.then(() => {
			this.channel.consume(this.subscribeQueue.queue, (message) => {
				let content = AMQPPoster.processContent(message);

				return Promise.resolve()
				.then(() => {
					return handler(content);
				});
			}, {noAck: true});
		});
	}

	/**
	 * Return decoded content of message
	 * @param message
	 * @returns {string}
	 */
	static processContent (message) {
		let content = message.content.toString(message.properties.contentEncoding || 'utf8');

		if (message.properties.contentType === 'application/json') {
			try {
				content = JSON.parse(content);
			} catch (err) {
				throw new AMQPPosterError('Can not JSON.parse the content');
			}

			if (content.data) {
				return content.data;
			} else if (content.error) {
				throw new Error(content.error.message);
			}
		}

		return content;
	}
}

module.exports = AMQPPoster;

