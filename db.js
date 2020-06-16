const { createPool, sql } = require('slonik')
const log = require('./logger')

// Initialize and check the connection to the database
const connectionString = process.env.PG_CONNECTION
if (!connectionString) {
  console.error(`No database configured, PG_CONNECTION not defined`)
  process.exit(1)
}
const pg = createPool(connectionString)

async function init() {
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

module.exports = { pg, sql, init }