$(() => {

  const m2 = new M2()

  m2.addEventListener('connect', () => {
    $('#disconnected').addClass('hidden')
  })

  m2.addEventListener('message', (event) => {
    const { message } = event
    const { id, mnemonic, ts, value } = message
    const output = `${id} ${mnemonic} @ ${ts} => ${value}`
    const $msg = $(`#msg${id}`)
    if ($msg.length == 0) {
      $(`<div id="msg${id}">${output}</div>'`).appendTo('#log')
    } else {
      $msg.text(output)
    }
  })

  m2.addEventListener('disconnect', (event) => {
    $('#disconnected').removeClass('hidden')
  })

})
