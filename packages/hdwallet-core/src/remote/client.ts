import { Revocable } from "../revocable";
import { RemoteCallResult } from "./types";

export class RemoteClient extends Revocable(class {}) {
  readonly #messagePort: Promise<MessagePort>;
  #queue: Promise<void> = Promise.resolve()

  protected constructor(messagePort: MessagePort | Promise<MessagePort>) {
    super();
    this.#messagePort = Promise.resolve(messagePort);
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
          // console.log(this.constructor.name, ev.data.type, ev.data.payload)
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
      (await this.#messagePort).postMessage({
        type: "call",
        method,
        args,
        port: port2,
      }, [port2])
      return await reply;
    })
  }
}
