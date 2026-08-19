export class EventBus {
  constructor() {
    this.subscribers = new Set()
  }

  subscribe(fn) {
    this.subscribers.add(fn)
    return () => this.subscribers.delete(fn)
  }

  emit(type, payload) {
    const event = { type, ...(payload || {}), _t: Date.now() }
    for (const fn of this.subscribers) {
      try {
        fn(event)
      } catch {
        /* subscriber errors must not break the bus */
      }
    }
    return event
  }

  dispatch(event) {
    this.emit(event.type, event)
  }
}