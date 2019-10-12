var express = require('express');
var router = express.Router();
var fs = require('fs')

router.post('/window', (req, res, next) => {
  fs.writeFile(`./logs/data-${Date.now()}.json`, JSON.stringify(req.body, null, 2),  (err) => {
    if (err) {
      throw err
    }
    res.status(200)
    res.send({
      result: 'OK'
    })
  })
})

router.post('/headers', (req, res, next) => {
  fs.writeFile(`./logs/headers-${Date.now()}.json`, JSON.stringify(req.headers, null, 2),  (err) => {
    if (err) {
      throw err
    }
    res.status(200)
    res.send({
      result: 'OK'
    })
  })
})

router.get('/dbc', (req, res) => {
  res.contentType('json')
  res.sendfile('./tesla_model3.dbc.json', { root: './dbc' })
})

router.get('/categories', (req, res) => {
  res.contentType('json')
  res.sendfile('./categories.json', { root: './dbc' })
})

module.exports = router;