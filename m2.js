const { Server } = require('ws')
const log = require('./logger')

// Id tracker for connection to help with debugging
let nextConnectionId = 0

// Create a standalone socket server so that we can route data from both http and
// https servers to it
const wss = new Server({ noServer: true })

// Connection handler for incoming socket requests
wss.on('connection', (ws) => {

  // route incoming connections to either the M2 handle or the client handler
  if (ws.url.pathname === '/m2device') {
      handleM2Connection(ws)
    } else {
      handleClientConnection(ws)
    }

  // set that the connection is alive now and on every received pong
  ws.alive = true
  ws.on('pong', () => {
    ws.alive = true
  })
})

// Ping pong mechanism to prevent idle disconnects and detect unresponsive web sockets
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.alive) {
      log.warn(`Terminating unresponsive client on socket ${ws.id}`)
      return ws.terminate()
    }
    ws.alive = false
    ws.ping()
  })
}, 2000)

// M2 connection handling that broadcasts connect and disconnect messages to clients
// as well as all binary messages send by the device
let m2
function handleM2Connection(ws) {
  log.info(`Connection ${ws.id} is M2`)
  if (m2) {
    const prevM2 = m2
    m2 = ws
    prevM2.terminate()
  }
  else {
    m2 = ws
    broadcast('m2:connect')
  }

  ws.on('message', (msg) => broadcast(msg))
  ws.on('pong', () => {})
  ws.on('close', () => {
    log.info(`Closing M2 connection ${ws.id}`)
    if (ws === m2 ) {
      broadcast('m2:disconnect')
      m2 = null
    }
  })
}

// Client connection handling that sends the M2 commands and handles auto sending of
// connect message if the M2 is already online; additionally a client that sends a
// command is deemed the "primary" client and will reset the M2's message flags upon
// disconnecting
let primary
function handleClientConnection(ws) {
  log.info(`Connection ${ws.id} is a client`)
  if (m2) {
    ws.send("m2:connect")
  }
  ws.on('message', (msg) => {
    primary = ws
    if (m2) {
      m2.send(msg)
    }
  })
  ws.on('close', () => {
    log.info(`Closing client connection ${ws.id}`)
    if (ws === primary) {
      primary = null
      if (m2) {
        m2.send(Uint8Array.of(1, 1, 0))
      }
    }
  })
}

// Broadcast a message to all connected clients
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
function handleUpgrade(req, socket, head) {
  const url = new URL(req.url, `ws://${req.headers.host}`)
  const id = nextConnectionId++
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