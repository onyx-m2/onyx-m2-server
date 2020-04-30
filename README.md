# Tesla Onyx M2 Server

This project is a Node socket server that works in conjunction with [tesla-onyx-m2-firmware](https://github.com/johnmccalla/tesla-onyx-m2-firmware), which allows a Macchina M2 to use this server to relay CANBUS messages to the Model 3's main screen.

*NOTE: This documentation is now out of date!!!*

## Installation

This is currently a pretty straight forward Node/Express server.

Start by setting up your environment in a .env file. It should have at least a `M2HOST` and `PIN` entry. The `PIN` is the "magic value" needed to authenticate (yes, this could be better, but hey, it's something).

```
  # .env
  M2HOST=your_server_hostname_here
  PIN=your_pin_code_here
  NODE_ENV=production
```

You should then be able to run.
```
  npm install
  npm start
```

## Apps

There are a small number of apps included as demos. As of this writing, they are
  - `/can` is a simple can bus viewer, which is useful to see the raw messages coming through.
  - `/signals` is a signal viewer that allows exploration of available can signals.
  - `/bttf/gauges` is a novelty back to the future center gauge cluster that shows a number of interesting live values

All of these are meant to be run from the Model 3's main screen.

## Tools

There are a number of tools included that will help with development.

- `bin/onyx-m2-monitor` monitors the canbus messages and saves them to a log file.
- `bin/m2-serial-replay` replays a log file to the serial port. This is useful for debugging the superb communication from the workbench.
- `bin/m2-ws-replay` replays a log file to the websocket. This is useful to debug application without having to be in the car and/or driving.
- `bin/parse-dbc` parses a dbc file and outputs a json file that may be consumed by applications.

## Model 3 browser findings

  - V10 is running a very recent version of Chrome (v75)
  - User agent string is appended with "Tesla" followed by a slash and the firmware
    version (Tesla/2019.32.11.1-d39e85a)
  - The screen width is 1260px and the height is reported as 931px, but is really 924px
  - Has most of the desktop APIs (when comparing to Chrome v74), but
    - No bluetooth functions
    - No notifications
  - Has touch support (ontouchcancel, ontouchend, ontouchmove, ontouchstart)
  - Some interesting sounding extra functions are present
    - teslaQuery
    - teslaQueryCancel
    - injectScript
    - teslaTryInit
    - teslaInit
    - teslaCss
    - teslaGeolocation

This last group would be interesting to figure out. The css one sounds appealing if
it allows us to know when the car switches to night mode. It would be awesome if
teslaQuery let us grab CAN messages, but yeah, just dreaming here.

## Raw notes to be cleaned up

### Things that would be useful:

  - Garage door open/close!!!

  - Weather, seeing the day's weather, and a view of next days

  - Calendar:
    - first meetings in the morning, and leaving work, the evening's activities
    - or really, like the google phone widget does it

  - Phone notifications
    - navigate them, left to right?
    - dismiss
    - activate the actions?
    - open and close (i.e. big pictures on netflix/reddit/etc)
    - read the notification out

  - Photos
    - quickly display your recently taken google photos
    - swipe left and right to move amongst them
    - maybe even a real time sync?

  - Dash/Sentry mode cams
    - review sentry events in car (e.g. when you step back in)
    - review dashcam from main screen (e.g. look back at you last lap, maybe you saw something cool, or whatever)

  - CAN data widgets
    - AMPS/kW - current, low, high, avg
    - kW non driving stuff (heating etc)
    - instant kWh consumption display
    - rpms? torque?
    - steering angles?
    - batt temps
    - regen and power limits
    - charging stats
    - soc in % (so batt ind. can stay in km)
    - coolant temps (batt + powertrain inlet)
    - ambient temp
    - batt cap in kWh with buffer shown
    - powertrain temps

  - Trip meters
    - Complete with stats about speed, time spent charging and stats, places visited, etc

  - Stop watch / countdown timer

  - General browsing
    - a system of "bookmarks" that integrates neatly into the dashboard?

  - Media display / control
    - Basically a redo of the native one, but can be integrated with other goodies

### Design

  - Have a number of small displays, and a single large display that you can display
    one thing at a time in

  - Small displays
    - Weather (1x1)
    - Next meeting/event (1x2)
    - Phone notification (1x2)
    - Stop watches (1x1)
    - Individual CANbus stats (1x1)
    - Navigate to another dash? (1x1)

  - Big displays
    - Trips
    - Full week's weather
    - Calendar (but maybe just use the Tesla one?)
    - General browsing
    - Photos
    - Dash/sentry cams

### Random implementation ideas:

  - Switch to night mode when connected phone goes on night light

  - To connect to dash/sentry cams we'd need an in car network of sorts
    - Maybe have a "High Performance LTE Vehicle Router" like the Airlink MP70
    - This would allow the "usb key to be a RPI that makes the vids avail on
      the local network for browsing from the main screen

  - The above in car network could serve for CAN data display too
    - The M2 could beam the data to the server running the dash cam and
      allow a web socket update to the main display

  - The trip display could be powered by the tesla api and mapbox

