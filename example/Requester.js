'use strict';

const Poster = require('../index');


(async () => {
	const poster = new Poster({
		name:     'Requester',
		uid:      String(process.pid),
		server:   'amqp://localhost',
		prefetch: 1,
	});

	await poster.init();

	console.log(`Requester started with pid ${process.pid}`);

	setInterval(() => {
		let reqObj = {from: Date.now() - 10, to: Date.now()};

		console.log(`Send request ${JSON.stringify(reqObj)}`);

		poster.send('Responder', reqObj)
		.then((respObj) => {
			console.log(`Got answer: ${JSON.stringify(respObj)}`);
		})
		.catch((err) => {
			console.log('Catch Error:', JSON.stringify(err));
		});
	}, 1000);
})();
