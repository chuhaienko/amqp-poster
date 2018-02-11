'use strict';

const Poster = require('../index');


const poster = new Poster({
	server:   'amqp://localhost',
	prefetch: 1,
});

poster.init()
.then(() => {
	setInterval(() => {
		let reqObj = {from: Date.now() - 10, to: Date.now()};

		console.log(`Send request ${JSON.stringify(reqObj)}`);

		poster.send('Responder', reqObj)
		.then((respObj) => {
			console.log(`Got answer: ${JSON.stringify(respObj)}`);
		})
		.catch((err) => {
			console.log('Catch Error:', err);
		});
	}, 1000);
});
