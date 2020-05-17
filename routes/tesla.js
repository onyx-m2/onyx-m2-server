const createError = require('http-errors')
const express = require('express')
const router = express.Router()
const request = require('request-promise-native')

const id = process.env.TESLA_ID
const accessToken = process.env.TESLA_ACCESS_TOKEN

const tesla = request.defaults({
  baseUrl: 'https://owner-api.teslamotors.com/api/1',
  headers: {
    'Authorization':  `Bearer ${accessToken}`,
    'User-Agent': 'Onyx'
  },
  json: true
})

router.post('/wakeup', async (req, res, next) => {
  try {
    res.json(await tesla.post(`/vehicles/${id}/wake_up`))
  }
  catch (e) {
    next(createError(e.statusCode, 'Tesla API Error'))
  }
})

module.exports = router
