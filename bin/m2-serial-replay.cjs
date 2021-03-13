#!/usr/bin/env node
require('dotenv').config()
const SerialPort = require('serialport')
const cobs = require('cobs')
const lineReader = require('line-reader')

const serialPort = process.argv[2]
const logFilename = process.argv[3]
const stepMode = process.argv[4]
var lastTs = 0

function sleep(millis) {
  if (stepMode) {
    console.log('Press enter to continue')
    return new Promise(resolve => process.stdin.once('data', function () {
      resolve()
    }))
  }
  return new Promise(resolve => setTimeout(resolve, millis))
}

const port = new SerialPort(serialPort, { baudRate: 115200, xon: true, xoff: true }, (err) => {
  if (err) {
    return console.error(err)
  }
  console.log(`Serial port ${serialPort} open, starting playback of log ${logFilename}`)

  port.on('data', (data) => {
    console.log('>> ', data.toString())
  })

  lineReader.eachLine(logFilename, async (line, last, cb) => {
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
    port.write(cobs.encode(Buffer.from(msg)))
    port.write([0x00])
    console.log(`<< ${line}`)
    if (last) {
      console.log('Done replaying the log')
      ws.close()
      cb(false)
    } else {
      cb()
    }
  })
})


