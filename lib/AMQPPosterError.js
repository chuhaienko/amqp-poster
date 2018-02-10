'use strict';


class AMQPPosterError extends Error {
	/**
	 * AMQPPosterError error
	 * @param message
	 */
	constructor (message) {
		super(message);

		Error.captureStackTrace(this, this.constructor);

		this.name              = 'AMQPPosterError';
		this.isAMQPPosterError = true;
	}
}

module.exports = AMQPPosterError;
