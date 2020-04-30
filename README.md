# Tesla Onyx M2 Server

This project is a Node socket server that works in conjunction with [tesla-onyx-m2-firmware](https://github.com/johnmccalla/tesla-onyx-m2-firmware), which allows a Macchina M2 to use this server to relay CANBUS messages to the Model 3's main screen.

*NOTE: This documentation is a work in progress!!! Please open issues to ask questions as needed.*

## Installation

This is currently a pretty straight forward Node/Express server.

Start by setting up your environment in a .env file. It should have at least an `AUTHORIZATION` entry, which corresponds
to the `pin` query string you need to provide to be able to access the relay.

If you want to deploy a secure version of the server, you should additionally have `SSL_KEY` and `SSL_CERT` that point 
to your SSL files. You almost certainly want this to use with any web app running on the car's main screen (as most 
hosting services require it now, for example, AWS Amplify).

You may also specify a `M2_HOSTNAME` value, which will be used by the tools to access your deployment.

```
  # .env
  M2_HOSTNAME=your_server_hostname_here
  AUTHORIZATION=your_authorization_code_here
  NODE_ENV=production
```

You should then be able to run.
```
  npm install
  npm start
```

## Deployment

TODO: a simple shoe string deployment example

## Apps

There are no longer any apps provided as part of the server. The server is now purely a data relay, 
augmented with some json data access services.

## Tools

There are a number of tools included that will help with development.

- `bin/onyx-m2-monitor` monitors the canbus messages and saves them to a log file.
- `bin/m2-serial-replay` replays a log file to the serial port. This is useful for debugging the superb communication from the workbench.
- `bin/m2-ws-replay` replays a log file to the websocket. This is useful to debug application without having to be in the car and/or driving.
- `bin/parse-dbc` parses a dbc file and outputs a json file that may be consumed by applications.
