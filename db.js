const { createPool, createMockPool, createMockQueryResult, sql } = require('slonik')
const log = require('./logger')

var pg

// Initialize and check the connection to the database
const connectionString = process.env.PG_CONNECTION
if (connectionString) {
  pg = createPool(connectionString)
}
else {
  console.error(`No database configured, data will not be saved`)
  pg = createMockPool({
    query: async () => createMockQueryResult([{
      tid: 1,
    }])
  })
}

async function init() {
  if (connectionString) {
    try {
      const version = await pg.oneFirst(sql`
        SELECT VERSION()
      `)
      log.info(`Connected to db using ${connectionString}`)
      log.info(version)
    }
    catch (e) {
      console.error(`Error connecting to the database: ${e.message}`)
      process.exit(1)
    }
  }
}

module.exports = { pg, sql, init }