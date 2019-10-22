var express = require('express');
var router = express.Router();
const url = require('url');

router.get('/', function(req, res, next) {
  if (req.pin) {
    return res.render('browsertests', {
      ip: req.ip,
      headers: Object.keys(req.headers).map((k) => ({
        key: k,
        value: req.headers[k]
      }))
    })
  }
  res.render('pin', {
    skipHeader: true
  })
})

module.exports = router;
