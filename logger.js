const log = require('simple-node-logger').createSimpleLogger({
  timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS',
})
log.setLevel(process.env.LOGGING_LEVEL || 'info')

module.exports = log
