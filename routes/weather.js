const createError = require('http-errors')
var express = require('express');
var router = express.Router();
var request = require('request-promise-native')

router.get('/:latitude/:longitude', async (req, res, next) => {
  const { longitude, latitude } = req.params
  try {
    const weather = await request(`https://api.darksky.net/forecast/1c3d7a4ad83e8ad979c510580a41663f/${latitude},${longitude}`, { json: true })
    res.json(weather)
  }
  catch (e) {
    next(createError(e.error.code, e.error.error))
  }
})

module.exports = router;
