export default class EventTarget {
  constructor() {
    this.listeners = {}
  }

  addEventListener(type, callback) {
    if (!(type in this.listeners)) {
      this.listeners[type] = []
    }
    this.listeners[type].push(callback)
  }

  removeEventListener(type, callback) {
    if (!(type in this.listeners)) {
      return
    }
    var stack = this.listeners[type]
    var i = stack.findIndex(cb => cb === callback)
    if (i !== -1) {
      stack.splice(i, 1)
    }
  }

  dispatchEvent(event) {
    if (!(event.type in this.listeners)) {
      return
    }
    event.target = this
    var stack = this.listeners[event.type]
    stack.forEach(cb => cb.call(this, event))
  }
}