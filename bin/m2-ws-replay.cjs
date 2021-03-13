#!/usr/bin/env node
/**
 * This script takes a log file produced by `onyx-m2-monitor` and replays on the
 * configured server, pretending to be an actual M2 device. This is very useful
 * for debugging while on the workbench, without having to get the car to produce
 * realtime data.
 *
 * @syntax
 * m2-ws-replay filename [stepMode]
 *
 * @argument {filename} Name of a log file to replay
 * @argument {stepMode} Optional flag to playback one line at time
 */

require('dotenv').config()
const lineReader = require('line-reader')
const WebSocket = require('ws');

const filename = process.argv[2]
const stepMode = process.argv[3]
var lastTs = 0

function sleep(millis) {
  if (stepMode) {
    console.log('Press enter to continue');
    return new Promise(resolve => process.stdin.once('data', function () {
      resolve();
    }))
  }
  return new Promise(resolve => setTimeout(resolve, millis));
}
const hostname = process.env.M2_HOSTNAME
const pin = process.env.AUTHORIZATION
const ws = new WebSocket(`ws://${hostname}/m2?pin=${pin}`);
ws.on('open', () => {
  console.log(`Server connected, starting replay of ${filename} to ${hostname}`)

  lineReader.eachLine(filename, async (line, last, cb) => {
    // <id> | <hexId> @ <ts> len <len> | <len data bytes>
    // 258 | 0x102 @ 313168976 len 8 | 77 00 00 00 01 00 20 0c
    var parts = /\d+ \| 0x(\w+) @ (\d+) len (\d+)/.exec(line)
    const id = parseInt(parts[1], 16)
    const ts = parseInt(parts[2])
    const len = parseInt(parts[3])
    const data = line.substr(line.lastIndexOf('|') + 2)

    if (lastTs) {
      await sleep(ts - lastTs)
    }
    lastTs = ts

    // [timestamp | id | length | data]
    var msg = [
      ts & 0xff,
      (ts >> 8) & 0xff,
      (ts >> 16) & 0xff,
      (ts >> 24) & 0xff,
      id & 0xff,
      (id >> 8) & 0xff,
      len & 0xff
    ]
    msg = msg.concat(data.match(/..?/g).map(s => parseInt(s, 16)))
    ws.send(Buffer.from(msg))
    console.log(line)
    if (last) {
      console.log('Done replaying the log')
      ws.close()
      cb(false)
    } else {
      cb()
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