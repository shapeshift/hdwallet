import * as native from "@shapeshiftoss/hdwallet-native";
import * as uuid from "uuid";
import * as bip39 from "bip39";

import { Vault } from "./vault";
import { crypto } from "./util";

export { argonBenchmark } from "./argonBenchmark"
export { Vault } from "./vault"

const createMnemonic = native.crypto.Isolation.Engines.Default.BIP39.Mnemonic.create.bind(
  native.crypto.Isolation.Engines.Default.BIP39.Mnemonic
);
const entropyToMnemonic = bip39.entropyToMnemonic.bind(bip39);

export const GENERATE_MNEMONIC = uuid.v4()

Vault.registerValueTransformer("#mnemonic", async (x: unknown) => {
  if (x !== GENERATE_MNEMONIC) return x
  const entropy = await (await crypto).getRandomValues(Buffer.alloc(16))
  return entropyToMnemonic(entropy)
})
Vault.registerValueWrapper("#mnemonic", async (x: unknown, addRevoker: (revoke: () => void) => void) => {
  if (typeof x !== "string") throw new TypeError("#mnemonic must be a string");
  const out = await createMnemonic(x);
  addRevoker(() => out.revoke());
  return out;
});
Vault.extensionRegistrationComplete();
