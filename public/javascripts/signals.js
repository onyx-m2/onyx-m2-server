$(() => {

  const m2 = new M2()

  m2.addEventListener('connect', () => {
    $('#disconnected').addClass('hidden')
    initSignals()
  })

  m2.addEventListener('message', (event) => {
    const { message } = event
    if (message.path == selectedMessagePath) {
      updateSignalValues(event.message)
    }
  })

  m2.addEventListener('disconnect', (event) => {
    $('#disconnected').removeClass('hidden')
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
    m2.clearAllMessageFlags()
    m2.setMessageFlags(message.id, 0x01)
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

  var { category: selectedCategoryPath, message: selectedMessagePath } = onyx.signal

  const categoryTemplate = Handlebars.compile($('#category-template').html())
  const messageTemplate = Handlebars.compile($('#message-template').html())
  const signalTemplate = Handlebars.compile($('#signal-template').html())

  $categories = $('#categories')
  $messages = $('#messages')
  $signals = $('#signals')

  initCategories()
  initMessages()

})
