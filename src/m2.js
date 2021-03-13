import ws from 'ws'
import { BitView } from 'bit-buffer'
import { sql } from 'slonik'
import request from 'request-promise-native'
import { promises as fs } from 'fs'

import { DBC } from 'onyx-m2-common'
import config from './config.js'
import log from './logger.js'
import { pg } from './db.js'

// Load the dbc file we'll be using
var dbc = null;
(async () => {

  log.info(`Loading dbc from ${config.dbc.file}`)
  var file = null
  try {
    if (config.dbc.file.startsWith('http')) {
      file = await request(config.dbc.file)
    } else {
      file = await fs.readFile(config.dbc.file, 'utf8')
    }
  }
  catch (e) {
    log.error(`Error loading dbc file.\n${e}`)
  }
  dbc = new DBC(file)
})()

// Interval at which to ping connections
const PING_INTERVAL = 1000

// Maximum allowable latency before the server terminates connections
const UNRESPONSIVE_LATENCY = 2000

// The timestamp of all recently received message from the M2
let recentMsgAt = []
let recentRate = 0

// Create a standalone socket server so that we can route data from both http and
// https servers to it
const wss = new ws.Server({ noServer: true })

// Get the M2 to use for all commands and connection metrics.
// The first directly connected m2 will be chosen if possible,
// and will fallback on the first relay if not available.
function activeM2() {
  const all = Array.from(wss.clients).filter(c => c.isM2)
  if (all.length === 0) {
    return null
  }
  const direct = all.find(c => c.isDirect)
  if (direct) {
    return direct
  }
  return all[0]
}

// Connection handler for incoming socket requests
wss.on('connection', (ws) => {

  // use array buffers, mostly because BitView is buggy when using
  // node buffers
  ws.binaryType = 'arraybuffer'

  // name the web socket to make logging a bit easier to follow
  ws.name = ws.url.pathname.slice(1)

  // route incoming connections to either the M2 handle or the client handler
  if (ws.name === 'm2') {
    handleM2(ws, true)
  } else if (ws.name === 'relay') {
    handleM2(ws, false)
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
    if (!ws.isM2) {
      sendJSON(ws, 'status', status)
    }
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
async function handleM2(ws, direct) {
  log.info(`New m2-${ws.id} connection`)
  ws.isM2 = true
  ws.isDirect = direct

  // if this is the only m2, update status and re-enable messages
  const allM2s = Array.from(wss.clients).filter(c => c.isM2)
  if (allM2s.length === 1) {
    broadcast('status', currentStatus())

    if (snifferRefs != 0) {
      enableAllMessages()
    } else {
      enableAllSubscribedMessages()
    }
  }

  ws.on('message', (message) => {
    recentMsgAt.push(Date.now())
    processMessage(ws, message)
  })

  ws.on('close', () => {
    log.info(`Detected closing of m2-${ws.id}`)

    // TODO >>> segment detection needs work; especially bad with secondary m2
    if (ws.segmentId) {
      pg.query(sql`
        UPDATE canbus_segments
        SET
          end_at = NOW(),
          end_id = (SELECT tid FROM canbus_msgs ORDER BY tid DESC LIMIT 1)
        WHERE tid = ${ws.segmentId}
      `)
    }

    const allM2s = Array.from(wss.clients).filter(c => c.isM2)
    if (allM2s.length === 1) {
      broadcast('status', currentStatus())
    }
  })
}

// Client send convenience function that packages the data into a json event
function sendJSON(ws, event, data) {
  ws.send(JSON.stringify({ event, data }))
}

// Get the current state of the M2
function currentStatus() {
  const m2 = activeM2()
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
    enableMessage(message.bus, message.id)
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
      disableMessage(message.bus, message.id)
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
    getLastMessageValue(message.bus, message.id)
    enableMessage(message.bus, message.id)
  })
}

function getLastSignalValues(signals) {
  const messages = [...new Set(signals.map(s => dbc.getSignalMessage(s)))]
  messages.forEach(m => getLastMessageValue(m.bus, m.id))
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
const CAN_MSG_FLAG_TRANSMIT_UNMODIFIED = 0x02
const CMDID_SET_ALL_MSG_FLAGS = 0x01
const CMDID_SET_MSG_FLAGS = 0x02
const CMDID_GET_MSG_LAST_VALUE = 0x03
const CMDID_GET_ALL_MSG_LAST_VALUE = 0x04

function getAllLastMessageValues() {
  const m2 = activeM2()
  const size = 0
  if (m2) {
    m2.send(Uint8Array.from([CMDID_GET_ALL_MSG_LAST_VALUE, size]))
  }
}

function getLastMessageValue(bus, id) {
  const m2 = activeM2()
  const size = 3
  if (m2) {
    m2.send(Uint8Array.from([CMDID_GET_MSG_LAST_VALUE, size, bus, id & 0xff, id >> 8]))
  }
}

function setAllMessageFlags(flags) {
  const m2 = activeM2()
  const size = 1
  if (m2) {
    m2.send(Uint8Array.from([CMDID_SET_ALL_MSG_FLAGS, size, flags & 0xff]))
  }
}

function setMessageFlags(bus, id, flags) {
  const m2 = activeM2()
  const size = 4
  if (m2) {
    m2.send(Uint8Array.from([CMDID_SET_MSG_FLAGS, size, bus, id & 0xff, id >> 8, flags & 0xff]))
  }
}

function enableAllMessages() {
  setAllMessageFlags(CAN_MSG_FLAG_TRANSMIT)
}

function disableAllMessages() {
  setAllMessageFlags(CAN_MSG_FLAG_RESET)
}

function enableMessage(bus, id) {
  setMessageFlags(bus, id, CAN_MSG_FLAG_TRANSMIT)
}

function disableMessage(bus, id) {
  setMessageFlags(bus, id, CAN_MSG_FLAG_RESET)
}

async function processMessage(ws, msg) {
  const data = new Uint8Array(msg)
  if (data.length < 8) {
    return log.warn(`Invalid message format, length is ${data.length}, message is ${data.toString()}`)
  }
  if (!ws.segmentId) {
    ws.segmentTs = Date.now()
  }
  const recvts = Date.now() - ws.segmentTs
  const ts = data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24)
  const bus = data[4]
  const id = data[5] | (data[6] << 8)
  const len = data[7]
  let buffer, bits
  try {
    buffer = Buffer.from(data.buffer, 8, len)
    bits = new BitView(data.buffer, 8, len)
  }
  catch (e) {
    log.error(`Error parsing data, length: ${data.length}, ts: ${ts}, bus: ${bus}, id: ${id}, len: ${len}`)
    log.error(e)
    return
  }

  // if this isn't the first message in the segment, just fire and forget
  if (ws.segmentId) {
    pg.query(sql`
      INSERT INTO canbus_msgs (recvts, ts, id, data)
      VALUES (${recvts}, ${ts}, ${id}, ${sql.binary(buffer)})
    `)
  }
  // if it's the first one, insert a first message, returning its id to be able
  // to create a new segment
  else {
    const { tid: msgId } = await pg.one(sql`
      INSERT INTO canbus_msgs (recvts, ts, id, data)
      VALUES (${recvts}, ${ts}, ${id}, ${sql.binary(buffer)})
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
    if (!ws.isM2 && ws.readyState === 1 && (ws.monitor || ws.sniffer)) {
      sendJSON(ws, 'message', [ ts, bus, id, Array.from(buffer) ])
    }
  })

  const def = dbc.getMessageFromId(bus, id)
  if (!def) {
    return log.warn(`No definition for message ${id} on bus ${bus}`)
  }

  const ingress = {}
  if (def.signals) {
    def.signals.forEach(s => {
      ingress[s.mnemonic] = dbc.decodeSignal(bits, s)
    })
  }
  if (def.multiplexor) {
    const multiplexId = ingress[def.multiplexor.mnemonic] = dbc.decodeSignal(bits, def.multiplexor)
    const multiplexed = def.multiplexed[multiplexId]
    if (multiplexed) {
      multiplexed.forEach(s => {
        ingress[s.mnemonic] = dbc.decodeSignal(bits, s)
      })
    } else {
      log.warn(`Message ${def.mnemonic} doesn't have a multiplexed signal for ${multiplexId}`)
    }
  }
  wss.clients.forEach(ws => {
    if (!ws.isM2 && ws.readyState === 1) {
      const subscribedSignals = ws.subscriptions.filter(s => s in ingress)
      const oneShotSignals = ws.oneShotSignals.filter(s => s in ingress)
      const signals = [...new Set([...subscribedSignals, ...oneShotSignals])].map(s => [s, ingress[s]])
      if (signals.length > 0) {
        sendJSON(ws, 'signal', signals)
      }
      ws.oneShotSignals = ws.oneShotSignals.filter(s => !oneShotSignals.includes(s))
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
  ws.subscriptions = []
  ws.oneShotSignals = []
  sendJSON(ws, 'hello', {
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
        sendJSON(ws, 'pong')
        break
      }

      case 'subscribe': {
        log.info(`Subscribe from client-${ws.id} for ${data}`)
        data.forEach(signal => {
          ws.subscriptions.push(signal)
          addSignalMessageRef(signal)
        })
        getLastSignalValues(data)
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
        ws.oneShotSignals.push(...data)
        getLastSignalValues(data)
        break
      }

      case 'get-message': {
        log.info(`Get message from client-${ws.id} for bus: ${data.bus}, id: ${data.id}`)
        getLastMessageValue(data.bus, data.id)
        break
      }

      case 'get-all-messages': {
        log.info(`Get all messages from client-${ws.id}`)
        getAllLastMessageValues()
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
    const lastClient = !Array.from(wss.clients).some(c => !c.isM2)
    if (lastClient) {
      log.info('Resetting all subscribed messages due to last client disconnecting')
      resetAllSubscribedMessages()
    }
  })
}

// Broadcast an M2 message to all connected clients
function broadcast(event, data) {
  wss.clients.forEach(ws => {
    if (!ws.isM2 && ws.readyState === 1) {
      sendJSON(ws, event, data)
    }
  })
}

// Authorization verification
function authorize(url) {
  return url.searchParams.get('pin') === config.authorization
}

// Handle upgrade requests from the server(s) and verify authorization
let nextId = 1
export function handleUpgrade(req, socket, head) {
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
