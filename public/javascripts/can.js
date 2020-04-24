$(() => {

  const row = Handlebars.compile($('#row-template').html())

  const m2 = new M2()
  var synced = true
  var filtered = true

  const timestamps = {}

  m2.addEventListener('connect', () => {
    $('#disconnected').addClass('hidden')
  })

  m2.addEventListener('message', (event) => {
    if (synced) {
      const { message } = event
      var { id, mnemonic, ts, value } = message
      timestamps[id] = Date.now()
      const $msg = $(`#msg${id}`)
      if ($msg.length == 0) {
        $('#log').append(row({id, mnemonic, value}))
      } else {
        $msg.find('.red.label').removeClass('basic')
        $msg.find('.value').text(value)
      }
    }
  })

  setInterval(() => {
    var now = Date.now()
    for(var id in timestamps) {
      if (now - timestamps[id] > 500) {
        $(`#msg${id} .red.label`).addClass('basic')
        delete timestamps[id]
      }
    }
  }, 500)

  m2.addEventListener('disconnect', (event) => {
    $('#disconnected').removeClass('hidden')
    $('#reason').text(`(${event.reason})`)
  })

  $('#filtertoggle').click(() => {
    if (filtered) {
      $('#filtertoggle').addClass('basic')
      m2.enableAllMessages()
    }
    filtered = false
  })

  $('#synctoggle').click(() => {
    if (synced) {
      $('#synctoggle').addClass('basic')
    } else {
      $('#synctoggle').removeClass('basic')
    }
    synced = !synced
  })

  function formatTs(ts) {
    return ts.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
})
