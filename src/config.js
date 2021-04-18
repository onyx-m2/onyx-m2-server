const config = {
  env: process.env.NODE_ENV || 'development',
  listen: {
    port: process.env.PORT || '80',
    securePort: process.env.SECURE_PORT || '443',
    address: process.env.LISTEN_ADDRESS || 'localhost',
  },
  ssl: {
    key: process.env.SSL_KEY,
    cert: process.env.SSL_CERT,
  },
  authorization: process.env.AUTHORIZATION,
  logging: {
    level: process.env.LOGGING_LEVEL || 'info'
  },
  db: {
    connection: process.env.PG_CONNECTION
  },
  dbc: {
    file: process.env.DBC_FILE || 'https://raw.githubusercontent.com/onyx-m2/dbc/master/tesla_model3.dbc'
  }
}

console.log(`Running in node ${config.env} environment`)
export default config
