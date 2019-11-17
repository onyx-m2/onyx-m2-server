var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {
  return res.render('browsertests', {
    ip: req.ip,
    headers: Object.keys(req.headers).map((k) => ({
      key: k,
      value: req.headers[k]
    }))
  })
})

module.exports = router;
