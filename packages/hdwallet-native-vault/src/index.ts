import { Vault } from "./vault";
import { GENERATE_MNEMONIC, crypto, createMnemonic, entropyToMnemonic } from "./util";

export { argonBenchmark } from "./argonBenchmark"
export type { ISealableVaultFactory, IVault, IVaultFactory } from './types'
export { GENERATE_MNEMONIC } from './util'
export { Vault } from "./vault"

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
