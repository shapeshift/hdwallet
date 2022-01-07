import * as core from "@shapeshiftoss/hdwallet-core";

export class MockMessagePort {
  _handler: (...args: any[]) => void = () => {}
  onmessage: (x: MessageEvent) => void = () => {}
  onmessageerror: (x: MessageEvent) => void = () => {}
  close() {}
  start() {}
  readonly addEventListener = core.untouchable('addEventListener')
  readonly removeEventListener = core.untouchable('removeEventListener')
  readonly dispatchEvent = core.untouchable('dispatchEvent')

  constructor() {}
  postMessage(msg: any) {
    console.log("postMessage", msg)
    this._handler({
      data: msg
    } as MessageEvent)
  }
}

export class MockMessageChannel {
  readonly port1 = new MockMessagePort()
  readonly port2 = new MockMessagePort()

  constructor() {
    this.port1._handler = x => this.port2.onmessage(x)
    this.port2._handler = x => this.port1.onmessage(x)
  }
}

globalThis.MessagePort ??= MockMessagePort
globalThis.MessageChannel ??= MockMessageChannel
