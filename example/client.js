'use strict';

const Poster = require('../index.js');


let poster = new Poster({
	server: 'amqp://localhost',
});

let message = [1, 2, 3, 4, 5];
console.log('I send message', message);

poster.sendMessage('Multiplier', message)
.then((answer) => {
	console.log('I got answer', answer);
});
