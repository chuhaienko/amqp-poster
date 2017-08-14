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
	server:   'amqp://localhost',
	name:     'ServiceName',
	prefetch: 1
});
```

```server``` - path for RabbitMQ server

```name``` - Service name. Also it is recipient name. It can be empty, and then app does not wait for incoming messages, except for answers.

```prefetch``` - How many message service can process at one time

## Send messages
```
poster.sendMessage('ServiceName', message)
.then((answer) => {
	// some logic
});
```

```message``` - object or other variable to send
```answer``` - response object. It contains ```data``` and ```error``` properties

## Message Handler for incoming messages
```
poster.messageHandler(function (message) {
	// some logic
	
	return answer;
});
```

```message``` - object or other variable was sent

```answer``` - object or other variable to send as answer. Can be Promised value
