import { Revocable } from "./util";

export type RemoteCall<T extends string = string, U extends Array<any> = unknown[]> = {
  type: "call",
  method: T,
  args: U,
  port?: MessagePort,
}

export type RemoteCallResult<T = unknown> = {
  type: "return",
  payload: T
} | {
  type: "throw",
  payload: Error
}

export abstract class RemoteServer {
  readonly messagePort: MessagePort
  #queue: Promise<void> = Promise.resolve()
  protected constructor() {
    const { port1, port2 } = new MessageChannel();
    this.messagePort = port2;
    port1.onmessageerror = (ev: MessageEvent) => { throw ev; }
    port1.onmessage = (ev: MessageEvent<RemoteCall>) => {
      this.#queue = this.#queue.then(async () => {
        try {
          const { type } = ev.data;
          switch (type) {
            case "call": {
              const { method, args, port } = ev.data as typeof ev.data & {type: "call"};
              try {
                const payload = await this.handleCall(method, ...args)
                port?.postMessage({
                  type: "return",
                  payload
                }, (payload instanceof MessagePort ? [payload] : []))
              } catch (e) {
                port?.postMessage({
                  type: "throw",
                  payload: e
                })
              }
              break;
            }
            default: throw new Error("unrecognized message type")
          }
        } catch (e) {
          console.error(e)
          this.messagePort.close()
        }
      })
    }
  }
  protected abstract handleCall(method: string, ...args: unknown[]): Promise<unknown>;
}

export class RemoteClient extends Revocable(class {}) {
  readonly #messagePort: MessagePort;
  #queue: Promise<void> = Promise.resolve()

  protected constructor(messagePort: MessagePort) {
    super();
    this.#messagePort = messagePort;
  }

  protected enqueue<T>(x: () => Promise<T>): Promise<T> {
    const out = this.#queue.then(async () => {
      try {
        return await x()
      } catch (e) {
        this.revoke()
        throw e
      }
    })
    this.#queue = out.then(() => {})
    return out
  }

  protected call<T = unknown>(method: string, ...args: any): Promise<T> {
    return this.enqueue(async () => {
      const { port1, port2 } = new MessageChannel();
      const reply = new Promise<T>((resolve, reject) => {
        port1.onmessageerror = (ev: MessageEvent) => reject(ev)
        port1.onmessage = (ev: MessageEvent<RemoteCallResult<T>>) => {
          switch (ev.data.type) {
            case "return":
              resolve(ev.data.payload);
              break;
            case "throw":
              reject(ev.data.payload);
              break;
            default:
              reject(ev.data);
          }
        }
      })
      if (args.length === 1 && typeof args[0] === "function") {
        args = await args[0]()
      }
      this.#messagePort.postMessage({
        type: "call",
        method,
        args,
        port: port2,
      }, [port2])
      return await reply;
    })
  }
}
