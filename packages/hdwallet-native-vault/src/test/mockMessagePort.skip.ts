export class MockMessagePort extends EventTarget {
  _target: EventTarget | null = null
  onmessage: ((x: MessageEvent) => void) | null = null
  onmessageerror: ((x: MessageEvent) => void) | null = null
  close() {}
  start() {}

  constructor() {
    super()
    this.addEventListener("message", (ev: Event) => {
      this.onmessage?.(ev as MessageEvent)
    })
  }
  postMessage(data: any) {
    // console.log("postMessage", data)
    const event = new MessageEvent("message", { data })
    this._target?.dispatchEvent(event)
  }
}

export class MockMessageChannel {
  readonly port1 = new MockMessagePort()
  readonly port2 = new MockMessagePort()

  constructor() {
    this.port1._target = this.port2
    this.port2._target = this.port1
  }
}

globalThis.MessagePort ??= MockMessagePort
globalThis.MessageChannel ??= MockMessageChannel
