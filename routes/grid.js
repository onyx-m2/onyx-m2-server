var express = require('express');
var router = express.Router();
var request = require('request-promise-native')

router.get('/', function(req, res, next) {
  res.render('grid', {
    title: 'Tesla Grid Tester'
  })
})

router.get('/canview', (req, res) => {
  res.render('canview', {
    title: 'Tesla CANbus View'
  })
})

router.get('/weather/:latitude/:longitude', async (req, res) => {
  const { longitude, latitude } = req.params
  const weather = await request(`https://api.darksky.net/forecast/1c3d7a4ad83e8ad979c510580a41663f/${latitude},${longitude}`, { json: true })
  res.render('weather', {
    layout: false,
    weather
  })
})


module.exports = router;
