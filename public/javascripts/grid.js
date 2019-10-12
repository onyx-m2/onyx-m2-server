$(() => {
  $.fn.api.settings.api = {
    'get weather': '/grid/weather/{latitude}/{longitude}'
  }

  var height = 924
  $('#down').click(() => {
    height++
    updateHeight()
  })

  $('#up').click(() => {
    height--
    updateHeight()
  })

  function updateHeight() {
    $('#height').text(height)
    $('.dash').css({
      height: `${height}px`
    })
  }

  navigator.geolocation.getCurrentPosition((pos) => {
    const { longitude, latitude } = pos.coords
    $('#weather').load(`/grid/weather/${latitude}/${longitude}`)
  })
  //   // $('#weather').api({
  //   //   action: 'get weather',
  //   //   urlData: { longitude, latitude },
  //   //   on: 'now',
  //   //   onSuccess: (res) => {
  //   //     console.log(res)
  //   //   },
  //   //   onResponse: function(response) {
  //   //     // make some adjustments to response
  //   //     console.log('response')
  //   //     return response;
  //   //   }
  //   // })
  // })
})
