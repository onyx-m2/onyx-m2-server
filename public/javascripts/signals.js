$(() => {

  var dbc
  var categories

  function getSelectedMessage() {
    return dbc.messages.find(m => m.category == selectedCategoryPath && m.path == selectedMessagePath)
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
    M2.clearAllMessageFlags()
    M2.setMessageFlags(message.id, 0x01)
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

  var { category: selectedCategoryPath, message: selectedMessagePath } = onyx.signal

  const categoryTemplate = Handlebars.compile($('#category-template').html())
  const messageTemplate = Handlebars.compile($('#message-template').html())
  const signalTemplate = Handlebars.compile($('#signal-template').html())

  $categories = $('#categories')
  $messages = $('#messages')
  $signals = $('#signals')

  M2.addEventListener('connect', (event) => {
    dbc = event.dbc
    categories = event.categories
    initCategories()
    initMessages()

    $('#disconnected').addClass('hidden')
  })

  M2.addEventListener('message', (event) => {
    const { message } = event
    if (message.path == selectedMessagePath) {
      updateMessageSignalValues(event.message)
    }
  })

  M2.addEventListener('disconnect', (event) => {
    $('#disconnected').removeClass('hidden')
  })

})
