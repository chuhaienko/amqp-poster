'use strict';

const Poster = require('../index');


(async () => {
	const poster = new Poster({
		name:      'Logger',
		uid:       String(process.pid),
		server:    'amqp://localhost',
		prefetch:  1,
		subscribe: [{
			exchange: 'NewNumber',
		}, {
			exchange:       'Error',
			oncePerService: true,
		}]
	});

	await poster.init();

	console.log(`Logger started with pid ${process.pid}`);

	poster.setBroadcastHandler(function (dataObj) {
		console.log(`Receive broadcast message ${JSON.stringify(dataObj)}`);
	});
})();
