const createError = require('http-errors')
const express = require('express')
const cookieParser = require('cookie-parser')
const log = require('./logger')

const app = express()
app.set('trust proxy', 1)
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())

// log incoming requests
app.use((req, res, next) => {
  log.info(`${req.method.toUpperCase()} ${req.url}`)
  next()
})

// simple pin based authorization that saves query string pin to cookies
// for convenience using a browser
app.use((req, res, next) => {
  const pin = req.query['pin'] | req.cookies['pin'] | req.body['pin']
  if (!pin) {
    return next(createError(401, 'No authorization provided'))
  }
  if (pin != process.env.AUTHORIZATION) {
    return next(createError(401, 'Invalid authorization provided'))
  }
  if (!req.cookies['pin']) {
    res.cookie('pin', pin, { maxAge: 31536000, httpOnly: false })
  }
  req.pin = pin
  next()
})

// TODO: maybe a data access api? save all m2 data to retrieve it later?

app.use('/', require('./routes/index'))
app.use('/weather', require('./routes/weather'))

app.use('/', (req, res) => {
  res.json({})
})

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404))
})

// error handler
app.use((err, req, res, next) => {
  const error = {
    status: err.status || 500,
    message: err.message
  }
  log.error(`${error.status} ${error.message}`)
  res.status(error.status)
  res.json(error)
})

module.exports = app
