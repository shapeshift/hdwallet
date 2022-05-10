import * as core from "@shapeshiftoss/hdwallet-core";
import * as jose from "jose";
import * as ta from "type-assertions";

import { MapVault } from "./mapVault";
import { RawVault } from "./rawVault";
import { ISealableVaultFactory, IVault, VaultPrepareParams } from "./types";
import { crypto, decoder, encoder, Revocable, revocable, shadowedMap } from "./util";

export type ValueWrapper = (x: unknown, addRevoker: (revoke: () => void) => void) => Promise<unknown>;
export type ValueTransformer = (x: unknown, addRevoker: (revoke: () => void) => void) => Promise<unknown>;

ta.assert<ta.Extends<typeof Vault, ISealableVaultFactory<Vault>>>();

export class Vault extends MapVault implements IVault {
  //#region static
  static async prepare(params?: VaultPrepareParams) {
    return MapVault.prepare(params);
  }
  static async create(password?: string, sealed = true) {
    return await Vault.open(undefined, password, sealed);
  }
  static async open(id?: string, password?: string, sealed = true) {
    await Vault.prepare();

    const out = new Vault(await RawVault.open(id, password));
    if (sealed) out.seal();
    if (id !== undefined && password !== undefined) await out.load();
    return out;
  }

  static #isPrivateKey(key: string) {
    return String(key).startsWith("#");
  }

  static #extensionRegistrationComplete = false;
  static extensionRegistrationComplete() {
    Vault.#extensionRegistrationComplete = true;
  }

  static readonly #valueWrappers: Map<string, ValueWrapper> = new Map();
  static registerValueWrapper(key: string, valueWrapper: ValueWrapper) {
    if (Vault.#extensionRegistrationComplete)
      throw new Error(`can't register value wrapper after registration is complete`);
    if (!Vault.#isPrivateKey(key)) throw new TypeError(`can't set value wrapper for non-private key '${key}'`);
    if (Vault.#valueWrappers.has(key)) throw new Error(`can't overwrite previously-set value wrapper for key '${key}'`);
    Vault.#valueWrappers.set(key, valueWrapper);
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
    if (Vault.#extensionRegistrationComplete)
      throw new Error(`can't register value transformer after registration is complete`);
    if (!Vault.#isPrivateKey(key)) throw new TypeError(`can't set value transformer for non-private key '${key}'`);
    if (Vault.#valueTransformers.has(key))
      throw new Error(`can't overwrite previously-set value transformer for key '${key}'`);
    Vault.#valueTransformers.set(key, valueTransformer);
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
    return revocable(out, this.addRevoker.bind(this));
  })();

  readonly #privateContents: Map<string, Promise<jose.FlattenedJWE>>;
  readonly #wrapperRevokers: Map<unknown, () => void> = new Map();

  protected constructor(rawVault: RawVault) {
    super(rawVault);
    this.#privateContents = revocable(new Map(), (x) => this.addRevoker(x));
    this.addRevoker(() => this.clear());
  }

  #revokeWrapperForValue(x: unknown) {
    this.#wrapperRevokers.get(x)?.();
    this.#wrapperRevokers.delete(x);
  }

  #revokeWrapperForKey(key: string) {
    this.#revokeWrapperForValue(this.#privateContents.get(key));
  }

  clear() {
    this.#privateContents.forEach((x) => this.#revokeWrapperForValue(x));
    this.#privateContents.clear();
    this.#wrapperRevokers.clear();
    super.clear();
  }

  delete(key: string) {
    this.#revokeWrapperForKey(key);
    this.#privateContents.delete(key);
    return super.delete(key);
  }

  set(key: string, value: unknown | Promise<unknown>): this {
    value = Vault.#transformValue(key, value, this.addRevoker.bind(this));
    if (!Vault.#isPrivateKey(key)) return super.set(key, value);

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

    const wrapperRevoker = new (Revocable(class {}))();
    const wrapper = Vault.#wrapPrivateValue(key, value, (x) => wrapperRevoker.addRevoker(x));
    this.#wrapperRevokers.set(key, () => wrapperRevoker.revoke());
    return super.set(key, wrapper);
  }

  #getUnwrapped(key: string): undefined | unknown | Promise<unknown> {
    if (!Vault.#isPrivateKey(key)) return this.get(key);
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
    return shadowedMap(this, (x: string) => this.#getUnwrapped(x), addRevoker);
  }

  #sealed = false;
  seal() {
    this.#sealed = true;
  }
  get sealed() {
    return this.#sealed;
  }

  unwrap(addRevoker?: (revoke: () => void) => void) {
    if (this.#sealed) throw new Error("can't unwrap a sealed vault");
    return this.#unwrap((x) => {
      this.addRevoker(x);
      addRevoker?.(x);
    });
  }

  async load() {
    await super.load(async (entries) => {
      this.clear();
      entries.forEach(([k, v]) => this.set(k, v));
    });
    return this;
  }

  async save() {
    const unwrappedRevoker = new (Revocable(class {}))();
    const unwrapped = this.#unwrap((x) => unwrappedRevoker.addRevoker(x));
    await super.save(
      async () =>
        await Promise.all(
          Array.from(unwrapped.entries()).map(async ([k, v]): Promise<[typeof k, typeof v]> => [k, await v])
        )
    );
    unwrappedRevoker.revoke();
    return this;
  }
}

Object.freeze(Vault);
Object.freeze(Vault.prototype);
Object.freeze(Object.getPrototypeOf(Vault));
