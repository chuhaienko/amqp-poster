'use strict';

/**
 * I listen to 'Responder' queue for direct requests.
 * When i got message I generate random number, publish it to 'NewNumber' exchange and return it in answer.
 * Sometimes I throw Error
 */

const Poster = require('../index');


(async () => {
	const poster = new Poster({
		name:     'Responder',
		uid:      String(process.pid),
		server:   'amqp://localhost',
		prefetch: 10
	});

	await poster.init();

	console.log(`Responder started with pid ${process.pid}`);

	poster.setMessageHandler((reqObj) => {
		console.log(`Got request ${JSON.stringify(reqObj)}`);

		let number = Math.floor(Math.random() * (reqObj.to - reqObj.from)  + 1) + reqObj.from;

		let respObj = {
			number: number
		};

		poster.publish('NewNumber', respObj);

		if (Math.random() < 0.3) {
			let error = new Error('Error happens');
			error.isFromApp = true;
			error.saomeKey = Date.now();

			poster.publish('Error', error);

			throw error;
		}

		return respObj;
	});
})();
