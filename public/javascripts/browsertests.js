$(() => {
  $.fn.api.settings.api = {
    'submit window data' : '/data/window',
    'submit tesla css' : '/data/css',
    'submit headers': '/data/headers'
  }

  // No keypresses are receive in the car from the steering wheel controls
//   $(document).keydown(function(ev){
//     alert(ev.keyCode);
//  });

  //$('#windowapi').text(Object.getOwnPropertyNames(window).toString().replace(/,/g, '\n'))
  // $('#window').api({
  //   action: 'submit window data',
  //   method: 'POST',
  //   data: Object.getOwnPropertyNames(window)
  //     .reduce((acc, cur) => {
  //       var p = window[cur]
  //       if (typeof(p) == 'function') {
  //         acc[cur] = Object.getOwnPropertyNames(p).toString()
  //         if (typeof(p.prototype) == "object") {
  //           acc[`${cur}.prototype`] = Object.getOwnPropertyNames(p.prototype).toString()
  //         }
  //       } else if (p != window) {
  //         acc[cur] = JSON.stringify(p)
  //       }
  //       return acc
  //     }, {})
  // })

  $('#headers').api({
    action: 'submit headers',
    method: 'POST'
  })

  $('#teslacss').click(() => {
    $('#data').text(JSON.stringify(teslaCss()))
  })

  var colorValue = 0
  $('#colorleft').click(() => {
    colorValue--
    updateColor()
  })
  $('#colorright').click(() => {
    colorValue++
    updateColor()
  })
  function updateColor() {
    var code = colorValue.toString()
    $('#colorvalue').text(code)
    $('.tesla.screen').css({
      backgroundColor:`rgb(${code}, ${code}, ${code})`
    })
  }

  // $('#colorslider').range({
	// 	min: 0,
	// 	max: 255,
  //   start: 250,
  //   onChange: (val) => {
  //     var code = val.toString(16)
  //     $('#colorvalue').text(code)
  //     $('body').css({
  //       backgroundColor:`#${code}${code}${code}`
  //     })
  //   }
	// })

// 	$('#zoomslider').range({
// 		min: 100,
// 		max: 150,
//     start: 100,
//     onChange: (val) => {
//       $('#zoomvalue').text(val)
//       $('body').css({
//         zoom:`${val}%`
//       })
//     }
// 	})

// 	$('#paddingslider').range({
// 		min: 0,
// 		max: 10,
//     start: 1,
//     step: 0.1,
//     onChange: (val) => {
//       $('#paddingvalue').text(val)
//       $('body').css({
//         padding:`${val}em`
//       })
//     }
// 	})
})