import logger from 'simple-node-logger'
import config from './config.js'

const log = logger.createSimpleLogger({
  timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS',
})
log.setLevel(config.logging.level)

export default log
