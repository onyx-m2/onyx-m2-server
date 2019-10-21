$(() => {

  var dbc
  var categories
  var m2
  var m2Connected

  function unpackMessageData(msg) {
    const ts = msg[0] | msg[1] << 8 | msg[2] << 16 | msg[3] << 24
    const id = msg[4] | msg[5] << 8
    const len = msg[6]
    const data = msg.slice(7, 7 + len)

    // M2RET version:
    // const parts = /(\d+) - (.+) [S|X] 0 (\d+) (.+)/.exec(messageData)
    // if (!parts) {
    //   return console.log(parts)
    // }
    // const ts = parseInt(parts[1])
    // const id = parseInt(parts[2], 16)
    // const len = parseInt(parts[3])
    // const data = parts[4].replace(/\b\w\b/g, '0$&')

    const message = dbc.messages.find(m => m.id == id)
    if (message) {
      // M2RET version:
      //const buf = new BitView(Uint8Array.from(data.match(/(\w\w)/g).map(byte => parseInt(byte, 16))).buffer)
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

  function requestMessageSignals(message) {
    if (m2Connected) {
      const { id } = message
      m2.send(Uint8Array.from([0, 0, 0])) // clear all flags
      m2.send(Uint8Array.from([id & 0xFF, id >> 8, 1])) // transmit id
    }
  }

  function signalDisplayUnits(signal) {
    if (signal.values) {
      const definedValue = signal.values[signal.value]
      if (definedValue) {
        return definedValue.replace(/_/g, ' ')
      }
    }
    return signal.units
  }

  $.when($.get('/data/dbc'), $.get('/data/categories')).done((dbcRes, categoriesRes) => {
    dbc = dbcRes[0]
    categories = categoriesRes[0]

    var { category: selectedCategoryPath, message: selectedMessagePath } = onyx.signal

    const categoryTemplate = Handlebars.compile($('#category-template').html())
    const messageTemplate = Handlebars.compile($('#message-template').html())
    const signalTemplate = Handlebars.compile($('#signal-template').html())

    $categories = $('#categories')
    $messages = $('#messages')
    $signals = $('#signals')

    function getSelectedMessage() {
      return dbc.messages.find(m => m.category == selectedCategoryPath && m.path == selectedMessagePath)
    }

    function initCategories() {
      categories.forEach(c => {
        $categories.append(categoryTemplate({
          tag: c.path.toUpperCase(),
          name: c.name,
          path: c.path,
          active: (c.path == selectedCategoryPath) ? 'active' : ''
        }))
      })
      $('#categories > a').click(function (e) {
        e.preventDefault();
        selectCategory($(this).attr('id'))
      })
    }

    initCategories()
    initMessages()

    function initMessages() {
      const messages = dbc.messages.filter(m => m.category == selectedCategoryPath)
      $messages.empty()
      messages.forEach((m, i) => {
        $messages.append(messageTemplate({
          id: m.id,
          name: m.name,
          path: m.path,
          category: m.category,
          active: (m.path == selectedMessagePath) ? 'active' : ''
        }))
      })
      $('#messages > a').click(function (e) {
        e.preventDefault();
        selectMessage($(this).attr('id'))
      })
      initSignals()
    }

    function initSignals() {
      $signals.empty()
      var message = getSelectedMessage()
      message.signals.forEach(s => {
        $signals.append(signalTemplate({
          name: s.name,
          value: s.value || '--',
          mnemonic: s.mnemonic,
          units: signalDisplayUnits(s)
        }))
      })
      requestMessageSignals(message)
    }

    function selectCategory(newCategoryPath) {
      $('#' + selectedCategoryPath).removeClass('active')
      $('#' + newCategoryPath).addClass('active')
      selectedCategoryPath = newCategoryPath
      selectedMessagePath = dbc.messages.find(m => m.category == newCategoryPath).path
      initMessages()
      window.history.pushState(null, '', `/signals/${selectedCategoryPath}/${selectedMessagePath}`)
    }

    function selectMessage(newMessage) {
      $('#' + selectedMessagePath).removeClass('active')
      $('#' + newMessage).addClass('active')
      selectedMessagePath = newMessage
      initSignals()
      window.history.pushState(null, '', `/signals/${selectedCategoryPath}/${selectedMessagePath}`)
    }

    function updateMessageSignalValues(message) {
      message.signals.forEach(s => {
        $(`#${s.mnemonic} .value`).text(s.value)
        $(`#${s.mnemonic} .label`).text(signalDisplayUnits(s))
      })
    }

    function connectM2() {
      m2 = new WebSocket(`wss://${location.host}/m2?pin=${onyx.pin}`)
      m2.binaryType = 'arraybuffer'
      m2.addEventListener('open', (event) => {
        m2Connected = true
        requestMessageSignals(getSelectedMessage())
        $("#disconnected").addClass('hidden')
      })
      m2.addEventListener('close', (event) => {
        m2Connected = false
        $("#disconnected").removeClass('hidden')
        setTimeout(connectM2, 1000)
      })
      m2.addEventListener('message', (event) => {
        const msg = new Uint8Array(event.data)
        if (msg.length >= 7) {
          const incomingMessage = unpackMessageData(msg)
          if (incomingMessage && incomingMessage.path == selectedMessagePath) {
            updateMessageSignalValues(incomingMessage)
          }
        }
      })
    }

    connectM2();

    // M2RET version:
    // m2.addEventListener('message', (event) => {
    //   var incomingData = String.fromCharCode.apply(null, new Uint8Array(event.data))
    //   incomingData.split('\n').forEach(incomingLine => {
    //     const incomingMessage = unpackMessageData(incomingLine)
    //     if (incomingMessage && incomingMessage.path == selectedMessagePath) {
    //       updateMessageSignalValues(incomingMessage)
    //     }
    //   })
    // })
  })

  $('#resume').click(() => {
    paused = false
  })

  $('#pause').click(() => {
    paused = true
  })
})
