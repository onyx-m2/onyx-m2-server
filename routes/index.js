const createError = require('http-errors')
var express = require('express')
var router = express.Router()

router.get('/', (req, res) => {
  res.json({})
})

router.get('/dbc', (req, res) => {
  res.json(req.app.get('dbc'))
})

module.exports = router
