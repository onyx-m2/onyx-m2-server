const { Server } = require('ws')
const { BitView } = require('bit-buffer')
const log = require('./logger')
const { pg, sql } = require('./db')

let dbc = null

function set(name, value) {
  switch (name) {
    case 'dbc':
      dbc = value
      break
  }
}

// Interval at which to ping connections
const PING_INTERVAL = 1000

// Maximum allowable latency before the server terminates connections
const UNRESPONSIVE_LATENCY = 4000

// The M2 device web socket
let m2 = null

// The timestamp of all recently received message from the M2
let recentMsgAt = []
let recentRate = 0

// Create a standalone socket server so that we can route data from both http and
// https servers to it
const wss = new Server({ noServer: true })

// Connection handler for incoming socket requests
wss.on('connection', (ws) => {

  // use array buffers, mostly because BitView is buggy when using
  // node buffers
  ws.binaryType = 'arraybuffer'

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
  const status = currentStatus()
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
    send(ws, 'status', status)
  })
}, PING_INTERVAL)

// M2 message rate mechanism
setInterval(() => {
  const now = Date.now()
  recentMsgAt = recentMsgAt.filter(t => now - t <= 1000)
  recentRate = recentMsgAt.length
}, 1000)

/**
 * M2 handler that broadcasts all binary messages send by the device
 * @param {*} ws Web socket to the M2 device
 */
async function handleM2(ws) {
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
    broadcast('status', currentStatus())
  }

  if (snifferRefs != 0) {
    enableAllMessages()
  } else {
    enableAllSubscribedMessages()
  }

  ws.on('message', (message) => {
    recentMsgAt.push(Date.now())
    processMessage(ws, message)
  })

  ws.on('close', () => {
    log.info(`Detected closing of m2-${ws.id}`)
    if (ws.segmentId) {
      pg.query(sql`
        UPDATE canbus_segments
        SET
          end_at = NOW(),
          end_id = (SELECT tid FROM canbus_msgs ORDER BY tid DESC LIMIT 1)
        WHERE tid = ${ws.segmentId}
      `)
    }
    if (ws === m2 ) {
      m2 = null
      broadcast('status', currentStatus())
    }
  })
}

// Client send convenience function that packages the data into a json event
function send(ws, event, data) {
  ws.send(JSON.stringify({ event, data }))
}

// Get the current state of the M2
function currentStatus() {
  let online = false
  let latency = 0
  let rate = recentRate
  if (m2 !== null) {
    online = true
    latency = m2.latency || 0
  }
  return [ online, latency, rate ]
}

var snifferRefs = 0
var signalEnabledMessageRefs = {} // a map of how many signals require a given message

function addSignalMessageRef(signal) {
  const message = dbc.getSignalMessage(signal)
  if (!message) {
    log.warn(`Attempting to subscribe to nonexistent signal ${signal}`)
   return
  }
  let refs = signalEnabledMessageRefs[message.mnemonic] || 0
  if (refs === 0) {
    enableMessage(message.id)
  }
  signalEnabledMessageRefs[message.mnemonic] = refs + 1
}

function releaseSignalMessageRef(signal) {
  const message = dbc.getSignalMessage(signal)
  if (!message) {
    log.warn(`Attempting to unsubscribe from nonexistent signal ${signal}`)
   return
  }
  let refs = signalEnabledMessageRefs[message.mnemonic] || 0
  if (refs > 0) {
    if (refs === 1) {
      disableMessage(message.id)
    }
    signalEnabledMessageRefs[message.mnemonic] = refs - 1
  }
}

function resetAllSubscribedMessages() {
  signalEnabledMessageRefs = {}
  disableAllMessages()
}

function enableAllSubscribedMessages() {
  log.debug(`Enabling all subscribed messages`)
  Object.keys(signalEnabledMessageRefs).forEach(mnemonic => {
    log.debug(`Enabling message ${mnemonic}, has ${signalEnabledMessageRefs[mnemonic]} signals`)
    const message = dbc.getMessage(mnemonic)
    enableMessage(message.id)
  })
}

function getLastSignalValues(signals) {
  const messages = [...new Set(signals.map(s => dbc.getSignalMessage(s)))]
  messages.forEach(m => getLastMessageValue(m.id))
}

function addSnifferRef() {
  snifferRefs++
  if (snifferRefs === 1) {
    enableAllMessages()
  }
}

function releaseSnifferRef() {
  snifferRefs--
  if (snifferRefs === 0){
    disableAllMessages()
    enableAllSubscribedMessages()
  }
}

const CAN_MSG_FLAG_RESET = 0x00
const CAN_MSG_FLAG_TRANSMIT = 0x01
const CMDID_SET_ALL_MSG_FLAGS = 0x01
const CMDID_SET_MSG_FLAGS = 0x02
const CMDID_GET_MSG_LAST_VALUE = 0x03

function getLastMessageValue(id) {
  const size = 2
  if (m2) {
    m2.send(Uint8Array.from([CMDID_GET_MSG_LAST_VALUE, size, id & 0xff, id >> 8]))
  }
}

function setAllMessageFlags(flags) {
  const size = 1
  if (m2) {
    m2.send(Uint8Array.from([CMDID_SET_ALL_MSG_FLAGS, size, flags & 0xff]))
  }
}

function setMessageFlags(id, flags) {
  const size = 3
  if (m2) {
    m2.send(Uint8Array.from([CMDID_SET_MSG_FLAGS, size, id & 0xff, id >> 8, flags & 0xff]))
  }
}

function enableAllMessages() {
  setAllMessageFlags(CAN_MSG_FLAG_TRANSMIT)
}

function disableAllMessages() {
  setAllMessageFlags(CAN_MSG_FLAG_RESET)
}

function enableMessage(id) {
  getLastMessageValue(id)
  setMessageFlags(id, CAN_MSG_FLAG_TRANSMIT)
}

function disableMessage(id) {
  setMessageFlags(id, CAN_MSG_FLAG_RESET)
}

function decodeSignal(buf, def) {
  try {
    const val = buf.getBits(def.start, def.length, def.signed)
    return def.offset + def.scale * val
  } catch {
    return NaN
  }
}

async function processMessage(ws, msg) {
  const data = new Uint8Array(msg)
  if (data.length < 7) {
    return log.warn(`Invalid message format, length is ${data.length}, message is ${data.toString()}`)
  }
  const ts = data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24)
  const id = data[4] | (data[5] << 8)
  const len = data[6]
  const value = new BitView(data.buffer, 7, len)

  // if this isn't the first message in the segment, just fire and forget
  if (ws.segmentId) {
    pg.query(sql`
      INSERT INTO canbus_msgs (ts, id, data)
      VALUES (${ts}, ${id}, ${sql.binary(value.buffer)})
    `)
  }
  // if it's the first one, insert a first message, returning its id to be able
  // to create a new segment
  else {
    const { tid: msgId } = await pg.one(sql`
      INSERT INTO canbus_msgs (ts, id, data)
      VALUES (${ts}, ${id}, ${sql.binary(value.buffer)})
      RETURNING tid
    `)

    const { tid: segmentId } = await pg.one(sql`
      INSERT INTO canbus_segments (start_id)
      VALUES (${msgId})
      RETURNING tid
    `)
    ws.segmentId = segmentId
  }

  wss.clients.forEach(ws => {
    if (ws !== m2 && ws.readyState === 1 && (ws.monitor || ws.sniffer)) {
      send(ws, 'message', [ id, ts, Array.from(data.slice(7)) ])
    }
  })

  const def = dbc.getMessageFromId(id)
  if (!def) {
    return log.warn(`No definition for message ${id}`)
  }

  const ingress = {}
  if (def.signals) {
    def.signals.forEach(s => {
      ingress[s.mnemonic] = decodeSignal(value, s)
    })
  }
  if (def.multiplexor) {
    const multiplexId = ingress[def.multiplexor.mnemonic] = decodeSignal(value, def.multiplexor)
    const multiplexed = def.multiplexed[multiplexId]
    if (multiplexed) {
      multiplexed.forEach(s => {
        ingress[s.mnemonic] = decodeSignal(value, s)
      })
    } else {
      log.warn(`Message ${def.mnemonic} doesn't have a multiplexed signal for ${multiplexId}`)
    }
  }
  wss.clients.forEach(ws => {
    if (ws !== m2 && ws.readyState === 1) {
      const signals = ws.subscriptions.filter(s => s in ingress).map(s => [s, ingress[s]])
      send(ws, 'signal', signals)
    }
  })
}

/**
 * Client handling that relays commands to the M2, and implements the message level
 * ping pong mechanism.
 * @param {*} ws Web socket to a client
 */
function handleClient(ws) {
  log.info(`New client-${ws.id} connection`)
  ws.name = 'client'
  ws.subscriptions = []
  send(ws, 'hello', {
    session: ws.id
  })
  ws.on('message', (msg) => {
    try {
      var { event, data } = JSON.parse(msg)
    }
    catch {
      log.warn(`Cannot parse message from client-${ws.id}: ${msg}`)
    }
    switch (event) {
      case 'ping': {
        send(ws, 'pong')
        break
      }

      case 'subscribe': {
        log.info(`Subscribe from client-${ws.id} for ${data}`)
        data.forEach(signal => {
          ws.subscriptions.push(signal)
          addSignalMessageRef(signal)
        })
        break
      }

      case 'unsubscribe': {
        log.info(`Unsubscribe from client-${ws.id} for ${data}`)
        data.forEach(signal => {
          const index = ws.subscriptions.indexOf(signal)
          if (index > -1) {
            ws.subscriptions.splice(index, 1)
            releaseSignalMessageRef(signal)
          }
        })
        break
      }

      case 'get': {
        log.info(`Get from client-${ws.id} for ${data}`)
        getLastSignalValues(data)
        break
      }

      case 'monitor': {
        log.info(`Monitor from client-${ws.id}: ${data}`)
        ws.monitor = data
        break
      }

      case 'sniffer': {
        log.info(`Sniffer from client-${ws.id}: ${data}`)
        if (data) {
          ws.sniffer = true
          addSnifferRef()
        } else {
          ws.sniffer = false
          releaseSnifferRef()
        }
        break
      }

      default: {
        log.warn(`Unknown event from client-${ws.id}: ${event}`)
      }
    }
  })

  ws.on('close', () => {
    log.info(`Detected closing of ${ws.name}-${ws.id}`)
    ws.subscriptions.forEach(mnemonic => {
      log.info(`Removing stale subscription ${mnemonic} of client-${ws.id}`)
      releaseSignalMessageRef(mnemonic)
    })
    delete ws.subscriptions
    if (ws.sniffer) {
      releaseSnifferRef()
    }
    if (m2 !== null && wss.clients.size == 1) {
      log.info('Resetting all subscribed messages due to last client disconnecting')
      resetAllSubscribedMessages()
    }
  })
}

// Broadcast an M2 message to all connected clients
function broadcast(event, data) {
  wss.clients.forEach(ws => {
    if (ws !== m2 && ws.readyState === 1) {
      send(ws, event, data)
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

module.exports = { set, handleUpgrade }