import { isIndexable } from "../utils";
import { RemoteCall } from "./types";

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
              // console.log(this.constructor.name, method, ...args)
              try {
                const payload = await this.handleCall(method, ...args)
                const transferrables: Transferable[] = [payload].concat(
                  isIndexable(payload) ? Object.values(payload) : []
                ).filter(x => x instanceof MessagePort).map(x => x as MessagePort)
                port?.postMessage({
                  type: "return",
                  payload
                }, transferrables)
              } catch (e) {
                port?.postMessage({
                  type: "throw",
                  payload: `${e}`
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
