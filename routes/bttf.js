var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {
  res.render('bttf', {
    title: 'Onyx BTTF',
    night: 'inverted'
  })
})

router.get('/gauges', function(req, res, next) {
  res.render('bttf-gauges', {
    title: 'Onyx Gauges',
    pin: req.pin,
    night: 'inverted'
  })
})

module.exports = router;
