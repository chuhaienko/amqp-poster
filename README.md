# AMQPPoster
A library for building communication between microservices.
It has simple and small API.
It works with amqplib and oriented to RabbitMQ.

# Installation
```
npm install amqp-poster
```

# API

## Instance
```
const Poster = require('amqp-poster');

(async () => {
	const poster = new Poster(options);
	
	await poster.init();
})();
```

### `options`
```
{
	name: 'TestService',
	uid:  'inst1',
	subscribe: [{
		exchange:       '',
		oncePerService: true
	}],
	prefetch: 10,
	server: {
		port:     5672,
		hostname: 'localhost',
		username: 'guest',
		password: 'guest'
	}
}
```
| key | required | type | description |
---------------------------------------
| name                       | true | string  | Service name. Also it is queue name for listening |
| uid                        |      | string  | String to identify owned queues |
| subscribe                  |      | array   | Collection of exchanges to subscribe |
| subscribe[].exchange       | true | string  | Name of exchange to subscribe |
| subscribe[].oncePerService |      | boolean | Apply round robin to messages for one service by name (default false) |
| prefetch                   |      | integer | How many messages process at one time (default 1) |
| server                     | true | string  | Connection url like 'amqp://guest:guest@localhost:5672' |
| server                     | true | object  | Object of connection config. May have next keys: protocol, hotname, port, username, password, locale, frameMax, heartbeat, vhost| 

## Send messages
```
try {
	let resp = await poster.send('ServiceName', reqObj)
	// some logic
} catch (err) {
	// Handle error
}
```

```reqObj``` - object or other variable to send

```respObj``` - response object

```err``` - error from respond-side

## Message Handler for incoming messages
```
poster.setMessageHandler(async (reqObj) => {
	// some logic
	
	// throw new Error('Some error');
	// or
	
	return respObj;
});
```

```reqObj``` - object or other variable was sent

```respObj``` - object or other variable to send as answer. Can be Promised value

## Publish broadcast message
```
await poster.publish('ExchangeName', reqObj);
```

## Handle broadcast messages
```
poster.setBroadcastHandler(function (reqObj) {
	// some logic
});
```
