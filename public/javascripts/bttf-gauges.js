$(() => {

  const m2 = new M2()

  m2.addEventListener('connect', () => {
    $('#disconnected').addClass('hidden')
    const messages = $('[data-message]')
      .map((i, el) => $(el).data('message')).toArray()
      .filter((val, idx, self) => self.indexOf(val) === idx)
    console.log(`Enabling: ${messages}`)
    m2.enableMessages(messages)
  })

  m2.addEventListener('message', (event) => {
    const { message } = event
    $(`[data-message=${message.mnemonic}]`).each((idx, el) => {
      const signal = DBC.findMessageSignal(message, $(el).data('signal'))
      if (signal && signal.value !== undefined) {
        $(el).text(Math.round(signal.value))
      }

    })
  })

  m2.addEventListener('disconnect', (event) => {
    $('#disconnected').removeClass('hidden')
    $('#reason').text(`(${event.reason})`)
  })

})
