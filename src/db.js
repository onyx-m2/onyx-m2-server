import { createPool, createMockPool, createMockQueryResult, sql } from 'slonik'

import config from './config.js'
import log from './logger.js'

export var pg

// Initialize and check the connection to the database
if (config.db.connection) {
  pg = createPool(config.db.connection)
}
else {
  log.warn(`No database configured, data will not be saved`)
  pg = createMockPool({
    query: async () => createMockQueryResult([{
      tid: 1,
    }])
  })
}

export async function init() {
  if (config.db.connection) {
    try {
      const version = await pg.oneFirst(sql`
        SELECT VERSION()
      `)
      log.info(`Connected to db using ${config.db.connection}`)
      log.info(version)
    }
    catch (e) {
      log.error(`Error connecting to the database, data will not be saved`)
    }
  }
}
