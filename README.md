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

const poster = new Poster({
	server:    'amqp://localhost',
	name:      'QueueNameForListening',
	prefetch:  1,
	subscribe: 'ExchangeNameForSubscribing'
});
```

```server``` - path for RabbitMQ server (or connection object for `amqp.connect()`)

```name``` - Service name. Also it is queue name for listening. If it is empty then app does not wait for incoming messages, except for answers.

```prefetch``` - How many message service can process at one time

```subscribe``` - Name of exchange for listening for broadcast messages

## Send messages
```
poster.send('ServiceName', reqObj)
.then((respObj) => {
	// some logic
})
.catch((err) => {
	// Handle error
});
```

```reqObj``` - object or other variable to send

```respObj``` - response object

```err``` - error from respond-side

## Message Handler for incoming messages
```
poster.setMessageHandler(function (reqObj) {
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
poster.publish('ExchangeName', reqObj);
```

## Handle broadcast messages
```
poster.setBroadcastHandler(function (reqObj) {
	// some logic
});
```
