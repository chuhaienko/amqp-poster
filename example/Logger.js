'use strict';

const Poster = require('../index');


const poster = new Poster({
	server:   'amqp://localhost',
	prefetch: 1,
	subscribe: 'NewNumber'
});

poster.init()
.then(() => {
	poster.setBroadcastHandler(function (dataObj) {
		console.log(`Receive broadcast message ${JSON.stringify(dataObj)}`);
	});
});
