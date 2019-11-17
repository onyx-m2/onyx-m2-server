var express = require('express')
var router = express.Router()

router.get('/', function(req, res, next) {
  res.render('can', {
    title: 'Onyx CAN'
  })
})

module.exports = router
