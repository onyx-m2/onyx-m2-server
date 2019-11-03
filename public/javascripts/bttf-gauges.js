$(() => {

  function formatVal(val) {
    var decimals = 0
    if (val > 0 && val < 10) {
      decimals = 1
    }
    return val.toFixed(decimals)
  }

  const m2 = new M2()

  m2.addEventListener('connect', () => {
    $('#disconnected').addClass('hidden')

    // ask for all messages that are requires by the gauges in view
    m2.enableMessages(
      $('[data-message]')
        .map((i, el) => $(el).data('message')).toArray()
        .filter((val, idx, self) => self.indexOf(val) === idx)
    )

    // ask for the messages needed for synthetic trip display
    m2.enableMessages(['DI_odometerStatus', 'BMS_kwhCounter'])
  })

  m2.addEventListener('message', (event) => {
    const { message } = event
    $(`[data-message=${message.mnemonic}]`).each((idx, el) => {
      const signal = DBC.findMessageSignal(message, $(el).data('signal'))
      if (signal && signal.value !== undefined) {
        $(el).text(formatVal(signal.value))
      }
    })
  })

  m2.addEventListener('disconnect', (event) => {
    $('#disconnected').removeClass('hidden')
    $('#reason').text(`(${event.reason})`)
  })

  // support for aux power percentage
  const diElecPower = DBC.findSignal('DI_power', 'DI_elecPower')
  const batVolts = DBC.findSignal('BMS_hvBusStatus', 'BMS_packVoltage')
  const batAmps = DBC.findSignal('BMS_hvBusStatus', 'BMS_packCurrent')
  setInterval(() => {
    const batPowerVal = (batAmps.value || 0) * (batVolts.value || 0) / 1000
    const diPowerVal = diElecPower.value || 0
    if (batPowerVal) {
      var val = 100
      if (diPowerVal > 0) {
        val = Math.round((batPowerVal - diPowerVal) * 100 / batPowerVal)
      }
      $('#auxPercent').text(val)
    }
  }, 250)

  // support for trip statistics
  const diOdometer = DBC.findSignal('DI_odometerStatus', 'DI_odometer')
  const bmsDischarge = DBC.findSignal('BMS_kwhCounter', 'BMS_kwhDischargeTotal')
  const bmsCharge = DBC.findSignal('BMS_kwhCounter', 'BMS_kwhChargeTotal')
  var odometerStart, chargeStart, dischargeStart, timeStart
  var tripStarted = false
  setInterval(() => {
    const odometer = diOdometer.value
    const charge = bmsCharge.value
    const discharge = bmsDischarge.value
    if (odometer === undefined || charge === undefined || discharge === undefined) {
      return
    }
    if (!tripStarted) {
      tripStarted = true
      odometerStart = odometer
      chargeStart = charge
      dischargeStart = discharge
      timeStart = Date.now()
    }
    const tripDistance = Math.max(odometer - odometerStart, 0)
    const tripMillis = (Date.now() - timeStart)
    const tripCharge = charge - chargeStart
    const tripDischarge = discharge - dischargeStart
    const tripEnergy = tripDischarge - tripCharge
    $('#tripDistance').text(formatVal(tripDistance))
    if (tripMillis > 0) {
      $('#tripSpeed').text(formatVal(tripDistance * 3600000 / tripMillis))
    }
    $('#tripEnergy').text(formatVal(tripEnergy))
    if (tripDistance > 0.01) {
      $('#tripConsumption').text(formatVal(tripEnergy * 1000 / tripDistance))
      $('#tripRegen').text(formatVal(tripCharge * 100 / tripDischarge))
    }
  }, 250)

  // show/hide trip panel
  $('.panel').click(() => {
    $('.trip.segment').toggleClass('hidden')
  })

  // reset trip
  $('#tripReset').click((ev) => {
    tripStarted = false
    ev.stopPropagation()
  })

})
