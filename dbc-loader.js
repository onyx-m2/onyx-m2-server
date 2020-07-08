const request = require('request-promise-native')
const MemoryStream = require('memorystream')
const fs = require('fs')
const lineReader = require('line-reader')
const log = require('./logger')
const DBC = require('./dbc')

const CATEGORIES = {
  apb: "Autopilot \"B\"",
  app: "Autopilot \"P\"",
  aps: "Autopilot \"S\"",
  bms: "Battery management system",
  cc: "Charge current",
  cmp: "Compressor",
  cmpd: "CMPD",
  cp: "Charge port",
  das: "Driver assistance system",
  dis: "Driver intervention system",
  di: "Drive inverter",
  epas3p: "Electic power assist steering",
  epas3s: "Electic power assist steering",
  epbl: "Left electric parking brake",
  epbr: "Right electric parking brake",
  esp: "Electronic stability program",
  fc: "Fast charge",
  gtw: "Gateway",
  hvp: "High voltage protection",
  ibst: "Power braking system",
  ocs1p: "Occupant classification system",
  odin: "Tesla diagnostics service",
  park: "Park assist system",
  pcs: "Power conversion system",
  pms: "Pedal monitor slave",
  pm: "Pedal monitor",
  ptc: "Heater",
  radc: "Radar",
  rcm: "Restraint control module",
  sccm: "Steering wheel control module",
  scm: "SCM",
  scs: "SCS",
  tas: "Tesla air suspension",
  tpms: "Tire pressure management system",
  uds: "Universal diagnostics system",
  ui: "User interface",
  utc: "Universal Time",
  umc: "UMC",
  vcfront: "Front vehicle controller",
  vcleft: "Left vehicle controller",
  vcright: "Right vehicle controller",
  vcsec: "Vehicle security controller",
  vin: "Vehicle identification",
  uncat: "Uncategorized"
}

module.exports = async (dbcFile) => {
  let dbc
  try {
    if (dbcFile.startsWith('http')) {
      dbc = new MemoryStream()
      request(dbcFile).pipe(dbc)
    } else {
      dbc = fs.createReadStream(dbcFile)
    }
    return new DBC(await generateDbc(dbc))
  }
  catch (e) {
    log.error(e)
  }
}

function toSlug(mnemonic) {
  return [...mnemonic]
    .map(c => (c != c.toLowerCase()) ? '-' + c.toLowerCase() : c)
    .join('')
}

function toName(mnemonic) {
  return [...mnemonic]
    .map((c, i) => {
      if (i == 0) {
        return c.toUpperCase()
      } else if (c != c.toLowerCase()) {
        return ' ' + c.toLowerCase()
      }
      return c
    })
    .join('')
}

async function generateDbc(stream) {
  const warnings = []
  const errors = []
  const messages = []
  return new Promise((resolve, reject) => {
    lineReader.eachLine(stream, function(line, last) {
      try {
        // message
        if (line.startsWith('BO_')) {
          const parts = /BO_ (\d+) (\w+_)?(\w+): (\d+)/.exec(line)
          if (!parts) {
            console.warn(`Failed to parse message: "${line}"`)
            warnings.push(line)
            return
          }
          const id = Number(parts[1])
          var category = 'UNCAT'
          if (parts[2]) {
            category = parts[2].substring(0, parts[2].length - 1)
            if (category.startsWith('ID')) {
              category = category.substring(5)
            }
          }
          const mnemonic = parts[3]
          const length = Number(parts[4])
          const slug = toSlug(mnemonic)
          const name = toName(mnemonic)
          messages.push({ id,
            mnemonic: `${category}_${mnemonic}`,
            category: category.toLowerCase(),
            slug, name, length
          })
        }

        // signal
        if (line.startsWith(' SG_')) {
          const parts = /\s*SG_ (\w+_)?(\S+)\s*(M?)m?(\d*)\s*: (\d+)\|(\d+)@\d(\+|-) \((.+),(.+)\) \[.+\] "(.*)"/.exec(line)
          if (!parts) {
            console.warn(`Failed to parse signal: "${line}"`)
            warnings.push(line)
            return
          }
          var category = 'UNK'
          if (parts[1]) {
            category = parts[1].substring(0, parts[1].length - 1)
          }
          var mnemonic = parts[2]
          var multiplexor = parts[3] == 'M' // ignoring for now
          var multiplexed = parts[4]      // ignoring for now
          const start = Number(parts[5])
          const length = Number(parts[6])
          const signed = parts[7] == '-'
          const scale = Number(parts[8])
          const offset = Number(parts[9])
          const units = parts[10]
          const slug = toSlug(mnemonic)
          const name = toName(mnemonic)

          const message = messages[messages.length - 1]
          const signal = {
            mnemonic: `${category}_${mnemonic}`,
            slug, name, start, length, signed, scale, offset, units
          }
          if ((multiplexor || multiplexed) && !message.multiplexed) {
            message.multiplexed = {}
          }
          if (multiplexor) {
            message.multiplexor = signal
          }
          else if (multiplexed) {
            if (!message.multiplexed[multiplexed]) {
              message.multiplexed[multiplexed] = []
            }
            message.multiplexed[multiplexed].push(signal)
          }
          else {
            if (!message.signals) {
              message.signals = []
            }
            message.signals.push(signal)
          }
        }

        // value
        if (line.startsWith('VAL_')) {
          var parts = /VAL_ (\d+) (\S+) (.*);/.exec(line)
          if (!parts) {
            console.warn(`Failed to parse value: "${line}"`)
            warnings.push(line)
            return
          }

          const id = Number(parts[1])
          const mnemonic = parts[2]
          const valueList = parts[3]
          const values = {}
          const re = /(\d+) "([^\"]+)"/g
          while (parts = re.exec(valueList)) {
            values[Number(parts[1])] = parts[2]
          }

          const message = messages.find(m => m.id == id)
          if (!message) {
            console.error(`Failed to find message for value: "${id}"`)
            errors.push(line)
            return
          }

          var signal
          if (message.signals) {
            signal = message.signals.find(s => s.mnemonic == mnemonic)
          }
          if (!signal && message.multiplexor) {
            if (message.multiplexor.mnemonic == mnemonic) {
              signal = message.multiplexor
            }
          }
          if (!signal && message.multiplexed) {
            Object.values(message.multiplexed).forEach(signals => {
              if (!signal) {
                signal = signals.find(s => s.mnemonic == mnemonic)
              }
            })
          }

          if (!signal) {
            console.error(`Failed to find signal for value: "${mnemonic}"`)
            errors.push(line)
            return
          }
          signal.values = values
        }

        if (last) {
          const categories = [...new Set(messages.map(m => m.category))].sort().map(slug => {
              let name = CATEGORIES[slug]
              if (!name) {
                name = `Unknown category ${slug.toUpperCase()}`
              }
              return { slug, name }
            })

          messages.forEach(m => {
            if (m.signals) {
              m.signals.sort((f, s) => f.start - s.start)
            }
            if (m.multiplexed) {
              Object.values(m.multiplexed).forEach(signals => {
                signals.sort((f, s) => f.start - s.start)
              })
            }
          })

          return resolve({ categories, messages, warnings, errors })
        }
      }
      catch (e) {
        e.message += `\nWhile processing: ${line}`
        reject(e)
        return false
      }
    })
  })
}
