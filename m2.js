const { Server } = require('ws')
const log = require('./logger')

// Interval at which to ping connections
const PING_INTERVAL = 1000

// Maximum allowable latency before the server terminates connections
const UNRESPONSIVE_LATENCY = 4000

// Message that instructs the M2 to disable sending of all messages, this is the
// only M2 binary message known to the server; it's here to provide a level of
// security for stopping the sending of data that's no longer needed in case all
// clients are disconnected
const DISABLE_ALL_MSGS = Uint8Array.of(1, 1, 0)

// The M2 device web socket
let m2 = null

// Create a standalone socket server so that we can route data from both http and
// https servers to it
const wss = new Server({ noServer: true })

// Connection handler for incoming socket requests
wss.on('connection', (ws) => {

  // route incoming connections to either the M2 handle or the client handler
  if (ws.url.pathname === '/m2device') {
    handleM2(ws)
  } else {
    handleClient(ws)
  }

  // reset ping time to zero (at), effectively resetting the circuit breaker for this
  // connection and update the latency information
  ws.at = 0
  ws.on('pong', () => {
    ws.latency = Date.now() - ws.at
    ws.at = 0
    log.debug(`Latency of ${ws.name}-${ws.id} is ${ws.latency} ms`)
  })
})

// Ping pong mechanism to prevent idle disconnects, detect unresponsive web sockets,
// and calculate latency
setInterval(() => {
  const now = Date.now()
  wss.clients.forEach((ws) => {
    if (ws.at !== 0) {
      ws.latency = now - ws.at
      if (ws.latency >= UNRESPONSIVE_LATENCY) {
        log.warn(`Terminating ${ws.name}-${ws.id} because latency is ${ws.latency}`)
        return ws.terminate()
      }
    }
    else {
      ws.at = now
      ws.ping()
    }
    ws.send(state())
  })
}, PING_INTERVAL)

// M2 handling that broadcasts all binary messages send by the device
function handleM2(ws) {
  log.info(`New m2-${ws.id} connection`)
  ws.name = 'm2'
  if (m2) {
    log.warn(`Terminating m2-${m2.id} due to new connection`)
    const prevM2 = m2
    m2 = ws
    prevM2.terminate()
  }
  else {
    m2 = ws
    broadcast(state())
  }
  ws.on('message', (msg) => broadcast(msg))
  ws.on('close', () => {
    log.info(`Detected closing of m2-${ws.id}`)
    if (ws === m2 ) {
      m2 = null
      broadcast(state())
    }
  })
}

// Client handling that relays commands to the M2, and implements the message level
// ping pong mechanism
function handleClient(ws) {
  log.info(`New client-${ws.id} connection`)
  ws.name = 'client'
  ws.send(state())
  ws.on('message', (msg) => {
    if (msg === 'ping') {
      ws.send('pong')
    }
    else if (m2) {
      m2.send(msg)
    }
  })
  ws.on('close', () => {
    log.info(`Detected closing of ${ws.name}-${ws.id}`)
    if (m2 !== null && wss.clients.size == 1) {
      log.info('Disabling all M2 messages')
      m2.send(DISABLE_ALL_MSGS)
    }
  })
}

// Obtain the current state of the M2
function state() {
  let conn = 0
  let latency = 0
  if (m2 !== null) {
    conn = 1
    latency = m2.latency || 0
  }
  return `m2:${conn}:${latency}`
}

// Broadcast an M2 message to all connected clients
function broadcast(msg) {
  wss.clients.forEach((client) => {
    if (client !== m2 && client.readyState === 1) {
      client.send(msg)
    }
  })
}

// Authorization verification
function authorize(url) {
  return url.searchParams.get('pin') === process.env.AUTHORIZATION
}

// Handle upgrade requests from the server(s) and verify authorization
let nextId = 1
function handleUpgrade(req, socket, head) {
  const url = new URL(req.url, `ws://${req.headers.host}`)
  const id = nextId++
  log.info(`Upgrading connection ${id} with url ${req.url} from ${req.socket.remoteAddress}`)

  const authorized = authorize(url)
  if (!authorized) {
    log.warn(`Authorization failed for connection ${id}`)
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
    socket.destroy()
    return
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.id = id
    ws.url = url
    wss.emit('connection', ws)
  })
}

module.exports = handleUpgrade