import { RemoteServer, revocable } from "@shapeshiftoss/hdwallet-core";

import * as BIP39 from "../../../core/bip39";
import * as BIP32 from "../bip32";

export class MnemonicServer extends RemoteServer {
  readonly #mnemonic: BIP39.Mnemonic

  protected constructor(mnemonic: BIP39.Mnemonic) {
    super()
    this.#mnemonic = mnemonic
  }

  addRevoker(revoke: () => void) {
    this.#mnemonic.addRevoker?.(revoke)
  }

  revoke() {
    this.#mnemonic.revoke?.()
  }

  static async create(mnemonic: BIP39.Mnemonic): Promise<MnemonicServer> {
    const obj = new MnemonicServer(mnemonic)
    return revocable(obj, (x) => obj.addRevoker(x))
  }

  protected async handleCall(method: string, ...args: unknown[]): Promise<unknown> {
    switch (method) {
      case "revoke":
        this.revoke()
        return
      case "toSeed": {
        const seed = await this.#mnemonic.toSeed(...(args as Parameters<BIP39.Mnemonic["toSeed"]>))
        const server = await BIP32.SeedServer.create(seed)
        return server.messagePort
      }
      default:
        throw new Error('no such method')
    }
  }
}
