(function(root) {

  class M2EventTarget extends EventTarget {

    constructor() {
      super()
      this._ws = null
      this._wsConnected = false
      this._m2Connected = false
      this.connect()
    }

    setAllMessageFlags(flags) {
      if (this._wsConnected) {
        this._ws.send(Uint8Array.from([1, 1, flags & 0xff]))
      }
    }

    setMessageFlags(id, flags) {
      if (this._wsConnected) {
        this._ws.send(Uint8Array.from([2, 3, id & 0xff, id >> 8, flags & 0xff]))
      }
    }

    getMessageValue(id) {
      if (this._wsConnected) {
        this._ws.send(Uint8Array.from([3, 2, id & 0xff, id >> 8]))
      }
    }

    disableAllMessages() {
      this.setAllMessageFlags(0x00)
    }

    enableMessage(messageOrMnemonic) {
      var message = messageOrMnemonic
      if (typeof(message) === 'string') {
        message = DBC.findMessage(message)
      }
      if (message) {
        this.getMessageValue(message.id)
        this.setMessageFlags(message.id, 0x01)
      }
    }

    enableMessages(messages) {
      var mnemonics = [...new Set(messages)]
      mnemonics.forEach(m => this.enableMessage(m))
      // {
      //   const msg = DBC.findMessage(mnemonic)
      //   if (msg) {
      //     this.getMessageValue(msg.id)
      //     this.setMessageFlags(msg.id, 0x01)
      //   }
      // })
    }

    enableSignals(signals) {
      signals = [...new Set(signals)]
      this.enableMessages(signals.map(s => s.message.mnemonic))
    }

    connect() {
      const ws = new WebSocket(`ws://onyx-m2.net/m2?pin=${onyx.pin}`)
      ws.binaryType = 'arraybuffer'
      ws.addEventListener('open', () => {
        this._wsConnected = true
      })
      ws.addEventListener('close', (event) => {
        this._wsConnected = false
        if (this._m2Connected) {
          this._m2Connected = false
          this.dispatchEvent(new DisconnectEvent('network'))
        }
        setTimeout(() => this.connect(), 1000)
      })
      ws.addEventListener('message', (event) => {
        if (typeof(event.data) === 'string') {
          const msg = event.data
          if (msg === 'm2:connect') {
            this._m2Connected = true
            this.dispatchEvent(new ConnectEvent())
          }
          else if (msg === "m2:disconnect") {
            this._m2Connected = false
            this.dispatchEvent(new DisconnectEvent('device'))
          }
        }
        else {
          const eventData = new Uint8Array(event.data)
          if (eventData.length >= 7) {
            const message = this.processMessage(eventData)
            if (message) {
              this.dispatchEvent(new MessageEvent(message))
            }
          }
        }
      })
      this._ws = ws
    }

    processMessage(msg) {
      const ts = msg[0] | msg[1] << 8 | msg[2] << 16 | msg[3] << 24
      const id = msg[4] | msg[5] << 8
      const len = msg[6]
      const data = msg.slice(7, 7 + len)

      const message = DBC.messages.find(m => m.id === id)
      if (message) {
        message.ts = ts
        message.value = data
        const buf = new BitView(data.buffer)
        if (message.signals) {
          this.processSignals(buf, message.signals)
        }
        const mp = message.multiplexor
        if (mp) {
          const id = message.multiplexor.value = buf.getBits(mp.start, mp.length, mp.signed)
          const multiplexed = message.multiplexed[id]
          if (multiplexed) {
            this.processSignals(buf, multiplexed)
          }
          else {
            console.log(`Unknown multiplexed signal for ${message.mnemonic}: ${id}`)
          }

        }
      }
      else {
        DBC.messages.push({
          id,
          mnemonic: `UNK_id${id}`,
          category: 'unk',
          path: 'id',
          name: '${id}',
          length: len,
          value: data
        })
      }
      return message
    }

    processSignals(buf, signals) {
      signals.forEach(s => {
        var value
        try {
          value = buf.getBits(s.start, s.length, s.signed)
          value = s.offset + s.scale * value
          s.value = Math.round(value * 100) / 100
        } catch {
          s.value = 'ERR'
        }
      })
    }

  }

  class ConnectEvent extends Event {

    constructor() {
      super('connect')
    }

  }

  class MessageEvent extends Event {

    constructor(message) {
      super('message')
      this.message = message
    }

  }

  class DisconnectEvent extends Event {

    constructor(reason) {
      super('disconnect')
      this.reason = reason
    }

  }

  root.M2 = M2EventTarget
}(this));