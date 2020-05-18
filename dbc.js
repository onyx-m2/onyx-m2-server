// DBC Access

class DBC {

  constructor(definitions) {
    this.categories = definitions.categories //Object.keys(definitions.categories).map(c => ({ slug: c, name: definitions.categories[c] }) )
    this.messages = definitions.messages

    // indexes
    this.messageById = {}
    this.messageByPath = {}
    this.messageByMnemonic = {}
    this.signalByMnemonic = {}
    this.messageBySignalMnemonic = {}
    this.messages.forEach(m => this.indexMessage(m))
  }

  toJSON() {
    const { categories, messages } = this
    return { categories, messages }
  }

  addMessage(message) {
    if (!this.getMessageFromId(message.id)) {
      this.messages.push(message)
      this.indexMessage(message)
    }
  }

  getMessageFromPath(categoryPath, messagePath) {
    return this.messageByPath[categoryPath + '/' + messagePath]
  }

  getMessageFromId(id) {
    return this.messageById[id]
  }

  getMessage(mnemonic) {
    return this.messageByMnemonic[mnemonic]
  }

  getSignal(mnemonic) {
    return this.signalByMnemonic[mnemonic]
  }

  getCategories() {
    return this.categories
  }

  getFirstCategory() {
    return this.categories[0]
  }

  getCategory(categorySlug) {
    return this.categories.find(c => c.slug === categorySlug)
  }

  getFirstCategoryMessage(categorySlug) {
    return this.messages.find(m => m.category === categorySlug)
  }

  getCategoryMessages(categorySlug) {
    return this.messages.filter(m => m.category === categorySlug)
  }

  getMessageSignals(mnemonic) {
    const message = this.getMessage(mnemonic)
    const signals = []
    if (message) {
      if (message.multiplexor) {
        signals.push(message.multiplexor)
      }
      if (message.signals) {
        signals = signals.concat(message.signals)
      }
      if (message.multiplexed) {
        signals = signals.concat(Object.values(message.multiplexed).flat())
      }
    }
    return signals
  }

  getSignalMessage(mnemonic) {
    return this.messageBySignalMnemonic[mnemonic]
  }

  indexMessage(message) {
    this.messageById[message.id] = message
    this.messageByPath[message.category + '/' + message.slug] = message
    this.messageByMnemonic[message.mnemonic] = message
    if (message.signals) {
      message.signals.forEach(s => {
        this.messageBySignalMnemonic[s.mnemonic] = message
        this.signalByMnemonic[s.mnemonic] = s
      })
    }
    if (message.multiplexor) {
      const { mnemonic } = message.multiplexor
      this.messageBySignalMnemonic[mnemonic] = message
      this.signalByMnemonic[mnemonic] = message.multiplexor
    }
    if (message.multiplexed) {
      Object.values(message.multiplexed).flat().forEach(s => {
        this.messageBySignalMnemonic[s.mnemonic] = message
        this.signalByMnemonic[s.mnemonic] = s
      })
    }
  }

}

module.exports = DBC
