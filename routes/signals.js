var createError = require('http-errors');
var express = require('express');
var router = express.Router();
var request = require('request-promise-native')

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
  res.render('signals2', {
    pin: req.pin,
    category: message.category,
    message: message.path,
    // categories: categories.map(c => ({
    //   path: `/signals/${c.path}`,
    //   label: c.path.toUpperCase(),
    //   name: c.name,
    //   active: (c == req.category) ? 'active' : ''
    // })),
    // messages: dbc.messages.filter(m => m.category == req.category.path).map(m => ({
    //   name: m.name,
    //   path: `/signals/${req.category.path}/${m.path}`,
    //   active: (m == message) ? 'active' : ''
    // })),
    // signals: message.signals.map(s => ({
    //   name: s.name,
    //   value: '--',
    //   units: s.units
    // }))
  })
})

module.exports = router;
