import * as core from "@shapeshiftoss/hdwallet-core";
import * as jose from "jose";
import * as ta from "type-assertions";

import { MapVault } from "./mapVault";
import { RawVault } from "./rawVault";
import { IVault, ISealableVaultFactory, VaultPrepareParams } from "./types";
import { crypto, decoder, encoder, shadowedAsyncMap } from "./util";

export type ValueWrapper = (x: unknown, addRevoker: (revoke: () => void) => void) => Promise<unknown>;
export type ValueTransformer = (x: unknown, addRevoker: (revoke: () => void) => void) => Promise<unknown>;

ta.assert<ta.Extends<typeof _Vault, ISealableVaultFactory<_Vault>>>();

class _Vault extends MapVault implements IVault {
  //#region static
  static async prepare(params?: VaultPrepareParams) {
    return MapVault.prepare(params);
  }
  static async create(password?: string, sealed: boolean = true) {
    return await _Vault.open(undefined, password, sealed);
  }
  static async open(id?: string, password?: string, sealed: boolean = true) {
    await _Vault.prepare();

    const out = new _Vault(await RawVault.open(id, password));
    if (sealed) out.seal();
    if (id !== undefined && password !== undefined) await out.load();
    return out;
  }

  static #isPrivateKey(key: string) {
    return String(key).startsWith("#");
  }

  static #extensionRegistrationComplete = false;
  static extensionRegistrationComplete() {
    _Vault.#extensionRegistrationComplete = true;
  }

  static readonly #valueWrappers: Map<string, ValueWrapper> = new Map();
  static registerValueWrapper(key: string, valueWrapper: ValueWrapper) {
    if (_Vault.#extensionRegistrationComplete)
      throw new Error(`can't register value wrapper after registration is complete`);
    if (!_Vault.#isPrivateKey(key)) throw new TypeError(`can't set value wrapper for non-private key '${key}'`);
    if (_Vault.#valueWrappers.has(key)) throw new Error(`can't overwrite previously-set value wrapper for key '${key}'`);
    _Vault.#valueWrappers.set(key, valueWrapper);
  }
  static #wrapPrivateValue(key: string, value: unknown | Promise<unknown>, addRevoker: (revoke: () => void) => void) {
    if (!this.#isPrivateKey(key)) throw new TypeError(`can't wrap value with non-private key '${key}'`);
    const valueWrapper = this.#valueWrappers.get(key);
    // if (!valueWrapper) throw new Error(`private key '${key}' does not have a registered value wrapper`)
    if (!valueWrapper) return core.untouchable(`no value wrapper registered for private key '${key}'`);
    return (async () => await valueWrapper(await value, addRevoker))();
  }

  static readonly #valueTransformers: Map<string, ValueTransformer> = new Map();
  static registerValueTransformer(key: string, valueTransformer: ValueTransformer) {
    if (_Vault.#extensionRegistrationComplete)
      throw new Error(`can't register value transformer after registration is complete`);
    if (!_Vault.#isPrivateKey(key)) throw new TypeError(`can't set value transformer for non-private key '${key}'`);
    if (_Vault.#valueTransformers.has(key))
      throw new Error(`can't overwrite previously-set value transformer for key '${key}'`);
    _Vault.#valueTransformers.set(key, valueTransformer);
  }
  static #transformValue(key: string, value: unknown | Promise<unknown>, addRevoker: (revoke: () => void) => void) {
    const valueTransformer = this.#valueTransformers.get(key);
    if (!valueTransformer) return value;
    return (async () => await valueTransformer(await value, addRevoker))();
  }
  //#endregion

  readonly #shieldingKey: Promise<CryptoKey> = (async () => {
    const out = (await crypto).subtle.generateKey(
      {
        name: "AES-KW",
        length: 256,
      },
      false,
      ["wrapKey", "unwrapKey"]
    );
    return core.revocable(out, this.addRevoker.bind(this));
  })();

  readonly #privateContents: Map<string, Promise<jose.FlattenedJWE>>;
  readonly #wrapperRevokers: Map<unknown, () => void> = new Map();

  protected constructor(rawVault: RawVault) {
    super(rawVault);
    this.#privateContents = core.revocable(new Map(), (x) => this.addRevoker(x));
    this.addRevoker(() => this.clear());
  }

  #revokeWrapperForValue(x: unknown) {
    this.#wrapperRevokers.get(x)?.();
    this.#wrapperRevokers.delete(x);
  }

  #revokeWrapperForKey(key: string) {
    this.#revokeWrapperForValue(this.#privateContents.get(key));
  }

  async clear() {
    this.#privateContents.forEach((x) => this.#revokeWrapperForValue(x));
    this.#privateContents.clear();
    this.#wrapperRevokers.clear();
    super.clear();
  }

  async delete(key: string) {
    this.#revokeWrapperForKey(key);
    this.#privateContents.delete(key);
    return super.delete(key);
  }

  async set(key: string, value: unknown): Promise<this> {
    value = _Vault.#transformValue(key, value, this.addRevoker.bind(this));
    if (!_Vault.#isPrivateKey(key)) return super.set(key, value);

    this.#revokeWrapperForKey(key);
    this.#privateContents.set(
      key,
      (async () => {
        const payload = encoder.encode(JSON.stringify(await value));
        return new jose.FlattenedEncrypt(payload)
          .setProtectedHeader({
            alg: "A256KW",
            enc: "A256GCM",
          })
          .encrypt(await this.#shieldingKey);
      })()
    );

    const wrapperRevoker = new (core.Revocable(class {}))();
    const wrapper = _Vault.#wrapPrivateValue(key, value, (x) => wrapperRevoker.addRevoker(x));
    this.#wrapperRevokers.set(key, () => wrapperRevoker.revoke());
    return super.set(key, wrapper);
  }

  #getUnwrapped(key: string): undefined | Promise<unknown> {
    if (!_Vault.#isPrivateKey(key)) return this.get(key);
    const jwe = this.#privateContents.get(key);
    if (!jwe) return undefined;
    return (async () => {
      const decryptResult = await jose.flattenedDecrypt(await jwe, await this.#shieldingKey, {
        keyManagementAlgorithms: ["A256KW"],
        contentEncryptionAlgorithms: ["A256GCM"],
      });
      const out = JSON.parse(decoder.decode(decryptResult.plaintext));
      return out;
    })();
  }

  #unwrap(addRevoker: (revoke: () => void) => void = (x) => this.addRevoker(x)) {
    return shadowedAsyncMap(this, async (x: string) => this.#getUnwrapped(x), addRevoker)
  }

  #sealed = false;
  async seal() {
    this.#sealed = true;
  }
  get sealed() {
    return Promise.resolve(this.#sealed)
  }

  async unwrap(addRevoker?: (revoke: () => void) => void) {
    if (this.#sealed) throw new Error("can't unwrap a sealed vault");
    return this.#unwrap((x) => {
      this.addRevoker(x);
      addRevoker?.(x);
    });
  }

  async load() {
    await super.load(async (entries) => {
      this.clear();
      for await (const [k, v] of entries) await this.set(k, v)
    });
  }

  async save() {
    const unwrappedRevoker = new (core.Revocable(class {}))() as core.Revocable;
    const unwrapped = this.#unwrap((x) => unwrappedRevoker.addRevoker(x));
    await super.save(async () => await unwrapped.entries());
    unwrappedRevoker.revoke();
  }
}

for (const k of ["registerValueTransformer", "registerValueWrapper", "extensionRegistrationComplete"]) {
  Object.defineProperty(_Vault, k, {
    ...Object.getOwnPropertyDescriptor(_Vault, k),
    enumerable: false
  })
}
Object.freeze(_Vault.prototype);
Object.freeze(Object.getPrototypeOf(_Vault));
export const Vault = core.freeze(core.overlay(_Vault, undefined, { bind: false }))
