'use strict';

const Poster = require('../index.js');


let poster = new Poster({
	server: 'amqp://localhost',
});


setInterval(() => {
	let message = Date.now();

	console.log('I send message', message);

	poster.sendMessage('Multiplier', message)
	.then((answer) => {
		console.log('I got answer', answer);
	});
}, 5000);
