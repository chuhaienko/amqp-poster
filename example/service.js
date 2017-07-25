'use strict';

const Poster = require('../index.js');


let poster = new Poster({
	server: 'amqp://localhost',
	name:   'Multiplier',
});

poster.messageHandler(function (mesage) {
	console.log('I got message', mesage);

	let answer = mesage.reduce((acc, v) => {
		return acc + v;
	}, 0);

	console.log('I will answer', answer, 'in second');

	return new Promise((resolve) => {
		setTimeout(() => {
			resolve(answer);
		}, 1000);
	});
});

poster.sendMessage('Multiplier', [3, 4, 5])
.then((answer) => {
	console.log('Answer for own request', answer);
});
