(function(root) {

  var dbc
  var categories
  var ws
  var wsConnected
  var m2Connected

  class M2EventTarget extends EventTarget {

    clearAllMessageFlags() {
      if (wsConnected) {
        ws.send(Uint8Array.from([0, 0, 0]))
      }
    }

    setMessageFlags(id, flags) {
      if (wsConnected) {
        ws.send(Uint8Array.from([id & 0xFF, id >> 8, flags]))
      }
    }

  }

  class ConnectEvent extends Event {
    constructor(dbc) {
      super('connect')
      this.dbc = dbc
      this.categories = categories
    }
  }

  class MessageEvent extends Event {
    constructor(dbc, message) {
      super('message')
      this.dbc = dbc
      this.message = message
    }
  }

  class DisconnectEvent extends Event {
    constructor(reason) {
      super('disconnect')
      this.reason = reason
    }
  }

  function processMessage(msg) {
    const ts = msg[0] | msg[1] << 8 | msg[2] << 16 | msg[3] << 24
    const id = msg[4] | msg[5] << 8
    const len = msg[6]
    const data = msg.slice(7, 7 + len)

    const message = dbc.messages.find(m => m.id == id)
    if (message) {
      message.ts = ts
      message.value = data
      const buf = new BitView(data.buffer)
      message.signals.forEach(s => {
        var value
        try {
          value = buf.getBits(s.start, s.length, s.signed)
        } catch {
          value = '<err>'
        }
        value = s.offset + s.scale * value
        s.value = Math.round(value * 100) / 100
      })
    }
    return message
  }

  $.when($.get('/data/dbc'), $.get('/data/categories')).done((dbcRes, categoriesRes) => {
    dbc = dbcRes[0]
    categories = categoriesRes[0]

    function connect() {
      ws = new WebSocket(`wss://${location.host}/m2?pin=${onyx.pin}`)
      ws.binaryType = 'arraybuffer'
      ws.addEventListener('open', () => {
        wsConnected = true
      })
      ws.addEventListener('close', (event) => {
        wsConnected = false
        if (m2Connected) {
          m2Connected = false
          M2.dispatchEvent(new DisconnectEvent('network'))
        }
        setTimeout(connect, 1000)
      })
      ws.addEventListener('message', (event) => {
        if (typeof(event.data) === 'string') {
          const msg = event.data
          if (msg === 'm2:connect') {
            m2Connected = true
            M2.dispatchEvent(new ConnectEvent(dbc, categories))
          }
          else if (msg === "m2:disconnect") {
            m2Connected = false
            M2.dispatchEvent(new DisconnectEvent('device'))
          }
        }
        else {
          const eventData = new Uint8Array(event.data)
          if (eventData.length >= 7) {
            const message = processMessage(eventData)
            M2.dispatchEvent(new MessageEvent(dbc, message))
          }
        }
      })
    }
    connect();
  })
  root.M2 = new M2EventTarget()
}(this));