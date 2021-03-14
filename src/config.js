import { exit } from 'process'
import dotenv from 'dotenv'
if (dotenv.config().error) {
  console.error('Unable to configure application, did you create a .env file?')
  exit(1)
}

export default {
  env: process.env.NODE_ENV || 'development',
  port: {
    http: process.env.HTTP_PORT || '80',
    https: process.env.HTTPS_PORT || '443',
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