# Onyx M2 Server

This project is a Node socket server that works in conjunction with [onyx-m2-firmware](https://github.com/onyx-m2/onyx-m2-firmware), which allows a Macchina M2 to use this server to relay CANBUS messages to the Model 3's main screen.

*NOTE: This documentation is a work in progress!!! Please open issues to ask questions as needed.*

# Installation

This is currently a pretty straight forward Node server.

Start by setting up your environment in a `.env` file. It should have at least an
`AUTHORIZATION` entry, which corresponds to the `pin` query string you need to provide
to be able to access the relay.

If you want to deploy a secure version of the server, you should additionally have
`SSL_KEY` and `SSL_CERT` that point to your SSL files. You almost certainly want this
to use with any web app running on the car's main screen (as most hosting services
require it now, for example, AWS Amplify).

You may also specify a `M2_HOSTNAME` value, which will be used by the tools to access
your deployment.

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

The DBC file is now in its own repo,
[onyx-m2-dbc](https://github.com/onyx-m2/onyx-m2-dbc). By default, the server will pull
a live copy of this file at startup. This may be overridden using the `DBC_FILE` config
variable.

All of the configuration options are now centralized in `./src/config.js`, and the
server no longer accesses the above variables directly.

*NOTE: this used to be a hybrid Express/Socket server. All of the non socket routes
have now been removed (and it's no even longer an Express server). This simplifies
the code, and give the server a single purpose.*

# Message Protocol

The M2 must be configured to open a web socket connection using the `/m2device`
endpoint, passing a `pin` query string corresponding to the agreed upon `AUTHORIZATION`
value.

Clients may connect to any other endpoint, using the same `pin`.

## Ping Pong Messages

Clients may implement a user level ping/pong mechanism. This is implemented to allow
web browser based applications detect stale connection. See the section on housekeeping
in the client interface below for details.

The server also implements protocol level ping pong for all connections, including the
M2.

## Data Messages

Any message that is binary is assumed to be a CAN message from the M2, or a control
message destined for the M2. See
[onyx-m2-firmware](https://github.com/onyx-m2/onyx-m2-firmware) for
up to date information on the format of the CAN messages and the commands.

*NOTE: This low-level interface is meant to be used between the M2 and the server
(and any other relays), not between clients and the server. There is now a high-level
interface documented below for this purpose.*

# Deployment

*TODO*: a simple shoe string deployment example

To run node apps on ports below 1024, run this once (and every time you upgrade your
node installation)
```
sudo setcap 'cap_net_bind_service=+ep' /usr/bin/node
```

# Apps

There are no longer any apps provided as part of the server. The server is now purely
a data relay and an arbitrator for web socket clients.

# Tools

There are a number of tools included that will help with development.

- `bin/onyx-m2-monitor` monitors the canbus messages and saves them to a log file.
- `bin/m2-serial-replay` replays a log file to the serial port. This is useful for
  debugging the superb communication from the workbench.
- `bin/m2-ws-replay` replays a log file to the websocket. This is useful to debug
  applications without having to be in the car and/or driving.

# Client Interface

Clients use a high-level interface to talk to the M2. No clients should use the binary
data protocol (only the M2 and any M2 relays).

## Sessions

A client begins by opening a new connection, and the server will acknowledge this by
saying hello and informing the client of its session id.

```js
  {
    event: 'hello',
    data: {
      session: id,
    }
  }
```
## Subscriptions

The client should then responds by setting up its signal subscriptions. These must
match the DBC's nomenclature, and multiple signals can be requested in a single
event. The server will figure out what messages need to be pulled off the CAN bus
to obtain all of the requested signals.

```js
  {
    event: 'subscribe',
    data: ['DI_elecPower']
  }
```

At any time afterwards, the client may also unsubscribe to any of these signals.

```js
  {
    event: 'unsubscribe',
    data: ['DI_elecPower']
  }
```

## Signal Events

Anytime there is an updated value in a message containing a subscribed signal, the
server notifies the client using the `signal` event. The payload is an array of
signal mnemonic and current value tuples (many may be present in any given event).

```js
  {
    event: 'signal',
    data: [
      ['DI_elecPower', 200]
      ...
    ]
  }
```

A client may also explicitly request the last value of any number of signals (that are
or are not subscribed to). This could also be useful for signals that don't change
frequently.  The server will emit the same signal event as a response to this.

```js
  {
    event: 'get',
    data: ['DI_isSunUp']
  }
```

## Connection Status

As mentioned above, a user-level ping-pong mechanism is implemented to allow browser
based applications to monitor the state of the connection. The events are simply:

```js
  // Client sends
  {
    event: 'ping'
  }

  // Server responds
  {
    event: 'pong'
  }
```

The server also sends periodic status updates to the client that indicate whether
the M2 is online, the latency between the M2 and the server (in ms), and the message
rate currently being received from the M2 (in messages/sec).

This latency can be combined with a client's own latency information (gleaned from
the message level ping pong messages) to get an idea of the delay between a CAN
message being read off the car's bus and its display on the in car screen. The formula
would be `(client_latency / 2) + (m2_latency / 2)`.

```js
  {
    event: 'status',
    data: [online, latency, rate]
  }
```

## Advanced

There are some additional events supported by the server that aren't really meant
for clients, and warning, are barely tested! None of these should be necessary for
typical applications.

```js
  // Clients can ask to be sniffers, which enables all messages on the M2 and forwards
  // them to the client
  {
    event: 'sniffer',
    data: true
  }

  // Client can also ask to be passive monitors, and receive all messages sent by
  // the M2
  {
    event: 'monitor',
    data: true
  }

  // Clients can also request the last value of a given message id on a given bus (the
  // server will emit the same message and signals events as a response to this that
  // it does when data is received from the M2)
  {
    event: 'get-message',
    data: {
      bus: 0,
      id: 789
    }
  }

  // Clients can also request the last value of a every message (the
  // server will emit the same message and signals events as a response to this that
  // it does when data is received from the M2)
  {
    event: 'get-all-messages'
  }

  // Server sends all messages to monitors and sniffers in non-decoded form
  {
    event: 'message'
    data: [id, ts, [0x12, 0x12, 0x12, ...]]
  }

```