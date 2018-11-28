'use strict';

const amqp            = require('amqplib');
const AMQPPosterError = require('./AMQPPosterError');
const uuid            = require('uuid/v1');
const Joi             = require('joi');


module.exports = class AMQPPoster {
	constructor (options) {
		let result = Joi.validate(options, Joi.object().keys({
			name:      Joi.string().required(),
			uid:       Joi.string().default(''),
			subscribe: Joi.array().items(
				Joi.object().keys({
					exchange:       Joi.string().required(),
					oncePerService: Joi.boolean().default(false),
				})
			).default([]),
			prefetch: Joi.number().integer().min(1).default(1),
			server:   Joi.alternatives(
				Joi.object().keys({
					port:      Joi.number(),
					protocol:  Joi.string(),
					hostname:  Joi.string(),
					username:  Joi.string(),
					password:  Joi.string(),
					locale:    Joi.string(),
					frameMax:  Joi.number(),
					heartbeat: Joi.number(),
					vhost:     Joi.string(),
				}).options({allowUnknown: true}),
				Joi.string(),
			).required(),
		}).required(), {allowUnknown: false});

		if (result.error) {
			throw result.error;
		}

		this.options = result.value;

		this.name = this.options.name;
		this.uid  = this.options.uid;

		this.pendingPromiseFuncs = {}; // Hash for promise's resolve/reject functions

		this.assertedExchanges = []; // Cache for publish exchanges which was already asserted

		this.connection      = undefined;
		this.channel         = undefined;
		this.subscribeQueues = [];
		this.responseQueue   = undefined;
		this.queue           = undefined;
	}

	/**
	 * Init RPC. Start queue for incoming messages (optional), start queue for answers
	 * @returns {Promise.<void>}
	 */
	async init () {
		// Create connection
		this.connection = await amqp.connect(this.options.server);

		// Create channel
		this.channel = await this.connection.createChannel();
		await this.channel.prefetch(this.options.prefetch);

		// Assert main income queue
		this.queue = await this.channel.assertQueue(this.name, {
			durable:    true,
			persistent: true
		});

		// Assert queue for answers
		this.responseQueue = await this.channel.assertQueue(`${this.name}-resp-${this.uid}-${uuid()}`, {
			exclusive: true
		});

		// Prepare subscribers
		for (let i = 0; i < this.options.subscribe.length; i += 1) {
			const subscribeData = this.options.subscribe[i];

			await this.channel.assertExchange(subscribeData.exchange, 'fanout', {
				durable: true
			});

			let subscribeQueue;

			if (subscribeData.oncePerService) {
				subscribeQueue = await this.channel.assertQueue(`${this.name}-subscribe-${subscribeData.exchange}`, {
					autoDelete: true
				});
			} else {
				subscribeQueue = await this.channel.assertQueue(`${this.name}-subscribe-${subscribeData.exchange}-${this.uid}-${uuid()}`, {
					exclusive: true
				});
			}

			this.subscribeQueues.push(subscribeQueue);
			await this.channel.bindQueue(subscribeQueue.queue, subscribeData.exchange, '');
		}

		// Handler for answer's queue
		this.channel.consume(this.responseQueue.queue, async (message) => {
			/**
			 *  There we get response for request
			 */
			let funcsObj = this.pendingPromiseFuncs[message.properties.correlationId];
			delete this.pendingPromiseFuncs[message.properties.correlationId];

			if (!funcsObj) {
				return;
			}

			try {
				const content = await AMQPPoster.processContent(message);
				return funcsObj.resolve(content);
			} catch (err) {
				funcsObj.reject(err);
			}
		}, {noAck: true});
	}

	/**
	 * Close connection
	 * @returns {Promise<T>}
	 */
	async close () {
		if (this.channel && this.channel.close) {
			await this.channel.close();
		}

		if (this.connection && this.connection.close) {
			return this.connection.close();
		}
	}

	/**
	 * Send message to queue. Return promise with answer
	 * @param to
	 * @param reqObj
	 * @returns {Promise.<void>}
	 */
	async send (to, reqObj) {
		const correlationId = uuid();

		let data = Buffer.from(JSON.stringify({data: reqObj}));
		let properties = {
			contentType:     'application/json',
			contentEncoding: 'utf8',
			replyTo:         this.responseQueue.queue,
			timestamp:       Date.now(),
			correlationId:   correlationId,
			persistent:      true,
		};

		let result = await this.channel.sendToQueue(to, data, properties);

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
	}

	/**
	 * Set handler for incoming messages from main income queue
	 * @param handler
	 * @returns {Promise.<void>}
	 */
	setMessageHandler (handler) {
		this.channel.consume(this.queue.queue, async (message) => {
			let content = AMQPPoster.processContent(message);

			let data;

			try {
				let answer = await handler(content);

				data = Buffer.from(JSON.stringify({data: answer === undefined ? '' : answer}));

			} catch (err) {
				if (err instanceof Error) {
					let errObj = {};

					Object.getOwnPropertyNames(err).forEach((k) => {
						errObj[k] = err[k];
					});

					data = Buffer.from(JSON.stringify({error: errObj}));
				} else {
					data = Buffer.from(JSON.stringify({error: err}));
				}
			}

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
		}, {noAck: false});
	}


	/**
	 * Publish messages
	 * @param to
	 * @param dataObj
	 * @returns {Promise<void>}
	 */
	async publish (to, dataObj) {
		if (!this.assertedExchanges.includes(to)) {
			await this.channel.assertExchange(to, 'fanout', {
				durable: true
			});
			this.assertedExchanges.push(to);
		}

		let correlationId = process.pid + '_' + process.hrtime().join('');

		let data = Buffer.from(JSON.stringify({data: dataObj}));
		let properties = {
			contentType:     'application/json',
			contentEncoding: 'utf8',
			timestamp:       Date.now(),
			correlationId:   correlationId,
			persistent:      true,
		};

		return this.channel.publish(to, '', data, properties);
	}

	/**
	 * Set handler for broadcasting messages from subscribed exchange
	 * @param handler
	 * @returns {Promise<void>}
	 */
	setBroadcastHandler (handler) {
		for (let i = 0; i < this.subscribeQueues.length; i += 1) {
			const subscribeQueue = this.subscribeQueues[i];

			this.channel.consume(subscribeQueue.queue, async (message) => {
				let content = AMQPPoster.processContent(message);
				return handler(content);
			}, {noAck: true});
		}
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

			if (content.error) {
				let error = new Error(content.error.message);
				Object.assign(error, content.error);

				throw error;
			} else {
				return content.data;
			}
		}

		return content;
	}
};
