'use strict';

const amqp = require('amqplib');


class AMQPPoster {
	constructor (options) {
		this.options = {
			server:   options.server,
			name:     options.name,
			prefetch: Number(options.prefetch) || 1,
		};

		this.isInited = false;
		this.answerResolvers = {};
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
		.then((channel) => { // Assert queue
			this.channel = channel;

			if (this.options.name) {
				this.channel.prefetch(this.options.prefetch);

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
				let content = AMQPPoster.processContent(message);

				let resolver = this.answerResolvers[message.properties.correlationId];
				delete this.answerResolvers[message.properties.correlationId];

				if (resolver) {
					resolver(content);
				}
			}, {noAck: true});

			this.isInited = true;
		});
	}

	/**
	 * Send message to queue. Return promise with answer
	 * @param to
	 * @param dataObj
	 * @returns {Promise.<void>}
	 */
	sendMessage (to, dataObj) {
		let correlationId = process.pid + '-' + process.hrtime().join('');

		return Promise.resolve()
		.then(() => {
			if (!this.isInited) {
				return this.init();
			}
		})
		.then(() => {
			let data = Buffer.from(JSON.stringify(dataObj));
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
				return undefined;
			}

			// Trick for resolve promise only when we get answer for request
			return new Promise((resolve) => {
				this.answerResolvers[correlationId] = resolve;
			});
		});
	}

	/**
	 * Set handler for incoming messages
	 * @param handler
	 * @returns {Promise.<void>}
	 */
	messageHandler (handler) {
		return Promise.resolve()
		.then(() => {
			if (!this.isInited) {
				return this.init();
			}
		})
		.then(() => {
			this.channel.consume(this.queue.queue, (message) => {
				let content = AMQPPoster.processContent(message);

				return Promise.resolve()
				.then(() => {
					return handler(content);
				})
				.then((answer) => {
					let to   = message.properties.replyTo;
					let data = Buffer.from(JSON.stringify(answer === undefined ? '' : answer));
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
				console.error(err);
			}
		}

		return content;
	}
}

module.exports = AMQPPoster;
