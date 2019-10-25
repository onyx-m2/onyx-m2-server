var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {
  res.render('bttf', {
    pin: req.pin,
    night: 'inverted'
  })
})

router.get('/gauges', function(req, res, next) {
  res.render('bttf-gauges', {
    pin: req.pin,
    night: 'inverted'
  })
})

module.exports = router;
