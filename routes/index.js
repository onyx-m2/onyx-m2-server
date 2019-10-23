var express = require('express');
var router = express.Router();
const url = require('url');

router.get('/', function(req, res, next) {
  if (req.pin) {
    return res.render('index', {
      night: 'inverted'
    })
  }
  res.render('pin', {
    skipHeader: true
  })
})

router.post('/', (req, res, next) => {
  res.cookie('pin', req.pin, { maxAge: 31536000, httpOnly: true })
  const referer = req.headers.referer
  var redirect = '/'
  if (referer) {
    const refererUrl = new URL(referer)
    redirect = refererUrl.searchParams.get('redirect') || redirect
  }
  res.redirect(redirect)
})

module.exports = router;
