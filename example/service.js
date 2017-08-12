'use strict';

const Poster = require('../index.js');


let poster = new Poster({
	server: 'amqp://localhost',
	name:   'Multiplier',
});

poster.messageHandler(function (message) {
	console.log('I got message', message);

	if (message % 2) {
		throw new Error('Message is odd!!!');
	}

	let delayTime = parseInt(Math.random() * 3000);

	console.log('I will answer in', delayTime, 'ms');

	return new Promise((resolve) => {
		setTimeout(() => {
			resolve(delayTime);
		}, delayTime);
	});
});
