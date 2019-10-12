$(() => {

  var dbc
  var categories

  function unpackMessageData(messageData) {
    const parts = /(\d+) - (.+) [S|X] 0 (\d+) (.+)/.exec(messageData)
    if (!parts) {
      return console.log(parts)
    }
    const ts = parseInt(parts[1])
    const id = parseInt(parts[2], 16)
    const len = parseInt(parts[3])
    const data = parts[4].replace(/\b\w\b/g, '0$&')

    const message = dbc.messages.find(m => m.id == id)
    if (message) {
      const buf = new BitView(Uint8Array.from(data.match(/.{1,2}/g).map(byte => parseInt(byte, 16))).buffer)
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

    var { category: selectedCategoryPath, message: selectedMessagePath } = onyx.signal

    const categoryTemplate = Handlebars.compile($('#category-template').html())
    const messageTemplate = Handlebars.compile($('#message-template').html())
    const signalTemplate = Handlebars.compile($('#signal-template').html())

    $categories = $('#categories')
    $messages = $('#messages')
    $signals = $('#signals')

    function initCategories(categoryPath) {
      categories.forEach(c => {
        $categories.append(categoryTemplate({
          tag: c.path.toUpperCase(),
          name: c.name,
          path: c.path,
          active: (c.path == categoryPath) ? 'active' : ''
        }))
      })
      $('#categories > a').click(function (e) {
        e.preventDefault();
        selectCategory($(this).attr('id'))
      })
    }

    initCategories(selectedCategoryPath)
    initMessages(selectedCategoryPath, selectedMessagePath)

    function initMessages(categoryPath, messagePath) {
      const messages = dbc.messages.filter(m => m.category == categoryPath)
      if (!messagePath) {
        messagePath = messages[0].path
      }
      $messages.empty()
      messages.forEach((m, i) => {
        $messages.append(messageTemplate({
          name: m.name,
          path: m.path,
          category: m.category,
          active: (m.path == messagePath) ? 'active' : ''
        }))
      })
      $('#messages > a').click(function (e) {
        e.preventDefault();
        selectMessage($(this).attr('id'))
      })
      initSignals(messagePath)
    }

    function initSignals(messagePath) {
      $signals.empty()
      var message = dbc.messages.find(m => m.path == messagePath)
      message.signals.forEach(s => {
        $signals.append(signalTemplate({
          name: s.name,
          value: s.value || '--',
          mnemonic: s.mnemonic,
          units: s.units
        }))
      })
    }

    function selectCategory(newCategoryPath) {
      $('#' + selectedCategoryPath).removeClass('active')
      $('#' + newCategoryPath).addClass('active')
      selectedCategoryPath = newCategoryPath
      selectedMessagePath = dbc.messages.find(m => m.category == newCategoryPath).path
      initMessages(selectedCategoryPath)
      window.history.pushState(null, '', `/signals/${selectedCategoryPath}/${selectedMessagePath}`)
    }

    function selectMessage(newMessage) {
      $('#' + selectedMessagePath).removeClass('active')
      $('#' + newMessage).addClass('active')
      selectedMessagePath = newMessage
      initSignals(selectedMessagePath)
      window.history.pushState(null, '', `/signals/${selectedCategoryPath}/${selectedMessagePath}`)
    }

    function updateMessageSignalValues(message) {
      message.signals.forEach(s => {
        const value = s.value
        $(`#${s.mnemonic} .value`).text(value)
        if (s.values) {
          var label
          const definedValue = s.values[value]
          if (definedValue) {
            label = definedValue.replace('_', ' ')
          } else {
            label = s.units
          }
          $(`#${s.mnemonic} .label`).text(label)
        }
      })
    }

    var m2 = new WebSocket(`wss://${location.host}/m2?pin=${onyx.pin}`)
    m2.binaryType = 'arraybuffer'
    m2.addEventListener('open', (event) => {
      $("#connection").removeClass('red').addClass('green')
    })
    m2.addEventListener('close', (event) => {
      $("#disconnected").removeClass('hidden')
    })
    m2.addEventListener('message', (event) => {
      var incomingData = String.fromCharCode.apply(null, new Uint8Array(event.data))
      incomingData.split('\n').forEach(incomingLine => {
        const incomingMessage = unpackMessageData(incomingLine)
        if (incomingMessage && incomingMessage.path == selectedMessagePath) {
          updateMessageSignalValues(incomingMessage)
        }
      })
    })
  })

  $('#resume').click(() => {
    paused = false
  })

  $('#pause').click(() => {
    paused = true
  })
})
