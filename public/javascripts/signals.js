$(() => {

  const m2 = new M2()
  const solarData = DBC.findMessage('UI_solarData')
  const isSunUp = DBC.findSignal('UI_isSunUp')

  m2.addEventListener('connect', () => {
    $('#disconnected').addClass('hidden')
    m2.getMessageValue(solarData)
    initSignals()
  })

  m2.addEventListener('message', (event) => {
    const { message } = event
    if (message === solarData) {
      displayMode = (isSunUp.value == 0 ? 'night' : 'day')
      updateDisplayMode()
    }
    if (message.path == selectedMessagePath) {
      updateSignalValues(event.message)
    }
  })

  m2.addEventListener('disconnect', (event) => {
    $('#disconnected').removeClass('hidden')
    $('#reason').text(`(${event.reason})`)
  })

  function getSelectedMessage() {
    return DBC.messages.find(m => m.category == selectedCategoryPath && m.path == selectedMessagePath)
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

  function initCategories() {
    $categories.empty()
    DBC.categories.forEach(c => {
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
      updateDisplayMode()
    })
  }

  function initMessages() {
    const messages = DBC.messages.filter(m => m.category == selectedCategoryPath)
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
      updateDisplayMode()
    })
    initSignals()
  }

  function initSignals() {
    $signals.empty()
    var message = getSelectedMessage()
    if (message.multiplexor) {
      addSignal(message.multiplexor)
    }
    if (message.signals) {
      message.signals.forEach(s => addSignal(s))
    }
    if (message.multiplexed) {
      Object.values(message.multiplexed).forEach(signals => {
        signals.forEach(s => addSignal(s))
      })
    }
    m2.disableAllMessages()
    m2.enableMessage(message)
  }

  function addSignal(signal) {
    $signals.append(signalTemplate({
      name: signal.name,
      value: signal.value || '--',
      mnemonic: signal.mnemonic,
      units: signalDisplayUnits(signal)
    }))
  }

  function selectCategory(newCategoryPath) {
    $('#' + selectedCategoryPath).removeClass('active')
    $('#' + newCategoryPath).addClass('active')
    selectedCategoryPath = newCategoryPath
    selectedMessagePath = DBC.messages.find(m => m.category == newCategoryPath).path
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

  function updateSignalValues(message) {
    if (message.multiplexor) {
      updateSignalValue(message.multiplexor)
      message.multiplexed[message.multiplexor.value].forEach(s => updateSignalValue(s))
    }
    if (message.signals) {
      message.signals.forEach(s => updateSignalValue(s))
    }
  }

  function updateSignalValue(signal) {
    $(`#${signal.mnemonic} .value`).text(signal.value)
    $(`#${signal.mnemonic} .label`).text(signalDisplayUnits(signal))
  }

  function updateDisplayMode() {
    if (displayMode === 'night') {
      $('.tesla').addClass('inverted')
    }
    if (displayMode === 'day') {
      $('.tesla').removeClass('inverted')
    }
  }

  var path = location.pathname.split('/')
  var selectedCategoryPath = path[2]
  var selectedMessagePath = path[3]
  var displayMode = 'day'

  const categoryTemplate = Handlebars.compile($('#category-template').html())
  const messageTemplate = Handlebars.compile($('#message-template').html())
  const signalTemplate = Handlebars.compile($('#signal-template').html())

  $categories = $('#categories')
  $messages = $('#messages')
  $signals = $('#signals')

  initCategories()
  initMessages()

})
