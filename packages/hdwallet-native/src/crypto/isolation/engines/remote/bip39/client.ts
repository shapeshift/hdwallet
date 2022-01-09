import { RemoteClient, revocable } from "@shapeshiftoss/hdwallet-core";

import * as BIP39 from "../../../core/bip39";
import * as BIP32 from "../bip32";

export class Mnemonic extends RemoteClient implements BIP39.Mnemonic {
  protected constructor(messagePort: MessagePort) {
    super(messagePort)
    this.addRevoker(() => this.call("revoke"))
  }

  static async create(messagePort: MessagePort): Promise<Mnemonic> {
    const obj = new Mnemonic(messagePort)
    return revocable(obj, (x) => obj.addRevoker(x))
  }

  async toSeed(passphrase?: string): Promise<BIP32.Seed> {
    if (passphrase !== undefined && typeof passphrase !== "string") throw new Error("bad passphrase type")

    const out = await BIP32.Seed.create(await this.call("toSeed", passphrase))
    this.addRevoker(() => out.revoke())
    return out
  }
}
