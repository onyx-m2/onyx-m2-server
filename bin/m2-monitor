#!/usr/bin/env node
require('dotenv').config()
const fs = require('fs')

const now = Date.now()
const messageLog = fs.createWriteStream(`./logs/m2-messages-${now}.log`)
const statusLog = fs.createWriteStream(`./logs/m2-status-${now}.log`)

const WebSocket = require('ws')

const hostname = process.env.M2_HOSTNAME
const pin = process.env.AUTHORIZATION
const ws = new WebSocket(`ws://${hostname}/monitor?pin=${pin}`)
ws.on('open', () => {
  console.log(`Monitoring active`)
  send('monitor', true)
  const start = Date.now()
  ws.on('message', (msg) => {
    const now = Date.now() - start
    const { event, data } = JSON.parse(msg)
    if (event === 'message') {
      const [ ts, bus, id, value ] = data
      messageLog.write(`[${now}][${ts}] ${bus} | ${id} | len ${value.length} | ${Buffer.from(value).toString('hex')}\n`)
      console.log(`[${now}] ts: ${ts} bus: ${bus} id:${id} value:${value}`)
    }
    else if (event === 'status') {
      const [ online, latency, rate ] = data
      statusLog.write(`[${now}] ${online} | ${latency} @ ${rate}\n`)
      console.log(`[${now}] online:${online} latency:${latency} rate:${rate}`)
    }
  })
})
ws.on('error', (e) => {
  console.log(`Error connecting to the server (${e.message}), exiting`)
  process.exit(1)
})
ws.on('close', () => {
  console.log('Server closed the connection, exiting')
  process.exit(1)
})

function send(event, data) {
  ws.send(JSON.stringify({event, data}))
}