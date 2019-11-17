var createError = require('http-errors')
var express = require('express')
var router = express.Router()

var dbc = require('../dbc/tesla_model3.dbc.json')
var categories = require('../dbc/categories.json')

router.param('category', (req, res, next, _category) => {
  const category = categories.find(c => c.path == _category)
  if (!category) {
    return next(createError(404, 'Category not found'))
  }
  req.category = category
  next()
})

router.get('/', function(req, res, next) {
  const category = dbc.messages[0].category
  const message = dbc.messages[0].path
  res.redirect(`/signals/${category}/${message}`)
})

router.get('/:category', (req, res, next) => {
  const message = dbc.messages.find(m => m.category == req.category.path)
  if (!message) {
    return next(createError(404, 'Category does have any messages defined'))
  }
  res.redirect(`/signals/${message.category}/${message.path}`)
})

router.get('/:category/:message', (req, res, next) => {
  const message = dbc.messages
    .find(m => m.path == req.params.message && req.category.path == m.category)
  if (!message) {
    return next(createError(404, 'Message not found'))
  }
  res.render('signals', {
    title: 'Onyx Signals'
  })
})

module.exports = router
