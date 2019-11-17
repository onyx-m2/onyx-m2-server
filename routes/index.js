var express = require('express')
var router = express.Router()

router.get('/', (req, res) => {
  if (req.pin) {
    return res.render('index', {
      night: 'inverted'
    })
  }
  res.render('pin', {
    skipHeader: true
  })
})

router.post('/', (req, res) => {
  const referer = req.headers.referer
  var redirect = '/'
  if (referer) {
    const refererUrl = new URL(referer)
    redirect = refererUrl.searchParams.get('redirect') || redirect
  }
  res.redirect(redirect)
})

module.exports = router
