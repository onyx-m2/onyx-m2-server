var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {
  res.render('can', {
    title: 'Onyx CAN',
    pin: req.pin
  })
})

module.exports = router;
