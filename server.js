#!/usr/bin/env node
import fs from 'fs'
import http from 'http'
import https from 'https'
import { exit } from 'process'

import config from './src/config.js'
import log from './src/logger.js'
import { init as initDb } from './src/db.js'
import { handleUpgrade } from './src/m2.js'

async function init() {

  // Check that authorization was configured
  if (!config.authorization) {
    console.error('Authorization not configured, secure your server!')
    exit(1)
  }

  // Initialize the database connection
  await initDb()

  // Create both a http server (for the m2), and a https server for the browser clients
  // that will likely be required to run https
  standUpServer(http, normalizePort(config.listen.port))
  if (config.ssl.key) {
    standUpServer(https, normalizePort(config.listen.securePort), {
      key: fs.readFileSync(config.ssl.key),
      cert: fs.readFileSync(config.ssl.cert)
    })
  }
}

// Stand up a server using the module and port, and optionally the options
function standUpServer(module, port, options) {
  const server = module.createServer(options || {})
  server.listen(port, config.listen.address)
  server.on('upgrade', handleUpgrade)
  server.on('error', (error) => handleError(error, port))
  server.on('listening', () => handleListening(server))
  return server
}

// Normalize a port into a number, string, or false
function normalizePort(val) {
  var port = parseInt(val, 10)
  if (isNaN(port)) {
    return val // named pipe
  }
  if (port >= 0) {
    return port // port number
  }
  return false
}

// Event listener for HTTP server "error" event
function handleError(error, port) {
  if (error.syscall !== 'listen') {
    throw error
  }
  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges')
      exit(1)
    case 'EADDRINUSE':
      console.error(bind + ' is already in use')
      exit(1)
    default:
      throw error
  }
}

// Event listener for HTTP server "listening" event
function handleListening(server) {
  var addr = server.address()
  var host = addr.address;
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port
  log.info(`Listening at ${host} on ${bind}`)
}

init()