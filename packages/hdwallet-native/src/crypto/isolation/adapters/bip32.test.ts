import * as core from "@shapeshiftoss/hdwallet-core";

import * as Default from "../engines/default";
import { BIP32Adapter } from "./bip32";

describe("BIP32Adapter", () => {
  it("derives xpubs correctly", async () => {
    const mnemonic = await Default.BIP39.Mnemonic.create("all all all all all all all all all all all all");
    const seed = await mnemonic.toSeed();
    const root = await seed.toMasterKey();
    const adapter = await BIP32Adapter.create(root);
    const xpubs = [adapter.neutered().toBase58()];
    for (const path of [
      "m/44'/0'/0'",
      "m/44'/60'/0'",
      "m/44'/114'/0'",
      "m/44'/118'/0'",
      "m/44'/194'/0'",
      "m/44'/235'/0'",
      "m/44'/330'/0'",
      "m/44'/459'/0'",
      "m/44'/529'/0'",
      "m/44'/714'/0'",
      "m/44'/931'/0'",
      "m/49'/0'/0'",
      "m/84'/0'/0'",
    ]) {
      let node = adapter;
      for (const index of core.hardenedPath(core.bip32ToAddressNList(path))) {
        node = await node.derive(index);
        const xpub = node.neutered().toBase58();
        if (!xpubs.includes(xpub)) xpubs.push(xpub);
      }
    }
    expect(xpubs).toMatchInlineSnapshot(`
    Array [
      "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",
    ]
  `);
  });
});
