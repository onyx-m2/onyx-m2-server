var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var app = express();
var server = require('http').Server(app)

app.set('trust proxy', 1)
var expressWs = require('express-ws')(app, server)

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true, parameterLimit:50000 }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// app.use('/pin/:pin', (req, res) => {
//   res.cookie('pin', req.params['pin'], { maxAge: 31536000, httpOnly: true })
//   res.status(200).send("Ok")
// })

app.use((req, res, next) => {
  // session ids don't work on the tesla because cookies don't land on the wss
  // connection for some reason; no other browser does this, thus we allow
  // the pin to be used in a query string
  var pin = req.query['pin'] | req.cookies['pin'] | req.body['pin']
  if (pin == '1379') {
    req.pin = pin
  }
  if (req.path != '/' && !req.pin) {
    return res.redirect(`/?redirect=${req.path}`)
  }
  next();
})

// canbus broadcast service; simply echos input to other connected clients;
// webrtc might be faster, but it needs TURN anyway, so not much difference
var m2DeviceWs
app.ws('/m2device', (ws, req) => {
  m2DeviceWs = ws
  broadcastToM2Clients('m2:connect')
  ws.on('message', (msg) => {
    broadcastToM2Clients(msg)
  })
  ws.on('close', () => {
    broadcastToM2Clients('m2:disconnect')
    m2DeviceWs = null
  })
})

var m2ControlWs
app.ws('/m2', (ws, req) => {
  // upon connecting a new m2 client, send the m2 connect message immediatly
  // if the m2 device is connected
  if (m2DeviceWs) {
    ws.send("m2:connect")
  }
  // any message received from a m2 client is forwarded to the device as a command
  // and is set as the "in charge" client (if that client disconnects, we'll reset
  // the m2 "cleanly")
  ws.on('message', (msg) => {
    m2ControlWs = ws
    if (m2DeviceWs) {
      m2DeviceWs.send(msg)
    }
  })
  ws.on('close', () => {
    if (ws === m2ControlWs) {
      m2ControlWs = null
      if (m2DeviceWs) {
        m2DeviceWs.send(Uint8Array.of(1, 1, 0))
      }
    }
  })
})

const wss = expressWs.getWss()

function broadcastToM2Clients(msg) {
  wss.clients.forEach((client) => {
    if (client !== m2DeviceWs && client.readyState == 1) {
      client.send(msg)
    }
  })
}

app.use('/', require('./routes/index'))
app.use('/browsertests', require('./routes/browsertests'))
app.use('/data', require('./routes/data'))
app.use('/grid', require('./routes/grid'))
app.use('/can', require('./routes/can'))
app.use('/signals', require('./routes/signals'))
app.use('/bttf', require('./routes/bttf'))

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') !== 'production' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = {app, server}
