import * as core from "@shapeshiftoss/hdwallet-core";
import { argon2id } from "hash-wasm";
import * as idb from "idb-keyval";
import * as jose from "jose";
import * as ta from "type-assertions";
import * as uuid from "uuid";

import { argonBenchmark } from "./argonBenchmark";
import { ArgonParams, IVaultBackedBy, IVaultFactory, VaultPrepareParams } from "./types";
import { crypto, encoder, keyStoreUUID, Revocable, revocable, setCrypto, setPerformance, vaultStoreUUID } from "./util";

// This has to be outside the class so the static initializers for defaultArgonParams and #machineSeed can reference it.
let resolvers:
  | Partial<{
      machineSeed: (_: CryptoKey) => void;
      defaultArgonParams: (_: ArgonParams | PromiseLike<ArgonParams>) => void;
      keyStore: (_: idb.UseStore) => void;
      vaultStore: (_: idb.UseStore) => void;
    }>
  | undefined = {};

ta.assert<ta.Extends<typeof RawVault, IVaultFactory<RawVault>>>();

export class RawVault extends Revocable(Object.freeze(class {})) implements IVaultBackedBy<Uint8Array> {
  //#region static: prepare()
  static readonly defaultArgonParams: Promise<ArgonParams> = new Promise(
    (resolve) => resolvers && (resolvers.defaultArgonParams = resolve)
  );

  // Caching the machine seed also conveniently hides the inability of the fake-indexeddb package to store CryptoKey objects.
  static readonly #machineSeed: Promise<CryptoKey> = new Promise(
    (resolve) => resolvers && (resolvers.machineSeed = resolve)
  );
  static readonly #keyStore: Promise<idb.UseStore> = new Promise(
    (resolve) => resolvers && (resolvers.keyStore = resolve)
  );
  static readonly #vaultStore: Promise<idb.UseStore> = new Promise(
    (resolve) => resolvers && (resolvers.vaultStore = resolve)
  );

  static async prepare(params?: VaultPrepareParams) {
    const currentResolvers = resolvers;
    resolvers = undefined;
    if (!currentResolvers) {
      if (params) throw new Error("can't call prepare with a parameters object after vault is already prepared");
      return;
    }

    setCrypto(params?.crypto ?? globalThis.crypto);
    setPerformance(params?.performance ?? globalThis.performance);

    currentResolvers.keyStore?.(params?.keyStore ?? idb.createStore(keyStoreUUID, "keyval"));
    currentResolvers.vaultStore?.(params?.vaultStore ?? idb.createStore(vaultStoreUUID, "keyval"));
    currentResolvers.machineSeed?.(
      (await idb.get<CryptoKey>("machineSeed", await RawVault.#keyStore)) ??
        (await (async () => {
          const machineSeed = await (
            await crypto
          ).subtle.importKey("raw", await (await crypto).getRandomValues(new Uint8Array(32)), "HKDF", false, [
            "deriveBits",
            "deriveKey",
          ]);
          await idb.set("machineSeed", machineSeed, await RawVault.#keyStore);
          return machineSeed;
        })())
    );

    currentResolvers.defaultArgonParams?.(
      (await idb.get<ArgonParams>("defaultArgonParams", await RawVault.#keyStore)) ?? {
        then: (onfulfilled, onrejected) => {
          return (async () => {
            const out: ArgonParams = {
              parallelism: 1,
              memorySize: 32 * 1024,
              iterations: 26,
            };
            const argonBenchmarkResults = await argonBenchmark(out.memorySize, 1000, { measureError: true });
            console.debug("argonBenchmarkResults:", argonBenchmarkResults);
            await idb.set("argonBenchmarkResults", argonBenchmarkResults, await RawVault.#keyStore);
            out.iterations = argonBenchmarkResults.iterations;
            await idb.set("defaultArgonParams", out, await RawVault.#keyStore);
            return out;
          })().then(onfulfilled, onrejected);
        },
      }
    );
  }
  //#endregion

  static async #deriveVaultKey(
    machineSeed: CryptoKey,
    id: string,
    argonParams: ArgonParams,
    password: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    addRevoker: (revoke: () => void) => void
  ) {
    const idBuf = encoder.encode(id);

    const argonSalt = new Uint8Array(
      await (
        await crypto
      ).subtle.deriveBits(
        {
          name: "HKDF",
          hash: "SHA-256",
          salt: idBuf,
          info: encoder.encode("argonSalt"),
        },
        machineSeed,
        128
      )
    );

    const argonKey = await argon2id({
      ...argonParams,
      password,
      salt: argonSalt,
      hashLength: 32,
      outputType: "binary",
    });

    // It might make more logical sense to use the argon-derived key in the salt field, but both fields provide
    // equivalent security, and using idBuf as the seed in both places permits some optimization by sharing
    // the result of HDKF-Extract between both calculations. (This isn't done right now, and can't be done with
    // the WebCrypto API as it is, but maybe we'll use something else some day.)
    const vaultKey = await (
      await crypto
    ).subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: idBuf,
        info: argonKey,
      },
      machineSeed,
      {
        name: "AES-KW",
        length: 256,
      },
      false,
      ["wrapKey", "unwrapKey"]
    );

    //TODO: Returning a revocable doesn't work here; WebCrypto in the browser complains about the proxy. Fix this.
    return vaultKey;
    // return revocable(vaultKey, addRevoker);
  }

  //#region static: VaultFactory<RawVault>
  static async create(password?: string) {
    return await RawVault.open(undefined, password);
  }

  static async open(id?: string, password?: string) {
    await RawVault.prepare();

    // eslint-disable-next-line @typescript-eslint/no-shadow
    const factory = async (id: string, argonParams: Promise<ArgonParams>) => {
      const vaultRevoker = new (Revocable(class {}))();
      const vault = revocable(new RawVault(id, argonParams), (x) => vaultRevoker.addRevoker(x));
      vault.addRevoker(() => vaultRevoker.revoke());
      return vault;
    };

    const out = await (async () => {
      if (id !== undefined) {
        const jwe = await idb.get<jose.FlattenedJWE>(id, await RawVault.#vaultStore);
        if (!jwe) throw new Error("can't find specified vault");
        const protectedHeader = jose.decodeProtectedHeader(jwe);
        const argonParams = protectedHeader.argon as ArgonParams | undefined;
        if (!argonParams) throw new Error("can't decode vault with missing argon parameters");

        return await factory(id, Promise.resolve(argonParams));
      } else {
        return await factory(
          uuid.v4({
            random: await (await crypto).getRandomValues(new Uint8Array(16)),
          }),
          RawVault.defaultArgonParams
        );
      }
    })();
    if (password !== undefined) await out.setPassword(password);
    return out;
  }

  static async list(): Promise<string[]> {
    await RawVault.prepare();
    const out = (await idb.keys(await RawVault.#vaultStore))
      .filter((k) => typeof k === "string")
      .map((k) => k as string);
    return out;
  }

  static async meta(id: string): Promise<Map<string, unknown> | undefined> {
    await RawVault.prepare();
    const jwe = await idb.get(id, await RawVault.#vaultStore);
    if (!jwe) return undefined;
    const meta = jose.decodeProtectedHeader(jwe).meta;
    if (!meta || !core.isIndexable(meta)) return undefined;
    const out = new Map();
    Object.entries(meta).forEach(([k, v]) => out.set(k, v));
    return out;
  }

  static async delete(id: string): Promise<void> {
    await RawVault.prepare();
    await idb.del(id, await RawVault.#vaultStore);
  }
  //#endregion

  readonly id: string;
  readonly #argonParams: Promise<Readonly<ArgonParams>>;
  readonly meta: Map<string, unknown> = new Map();

  #key: CryptoKey | undefined;

  protected constructor(id: string, argonParams: Promise<ArgonParams>) {
    super();
    this.id = id;
    this.#argonParams = argonParams.then((x) => Object.freeze(JSON.parse(JSON.stringify(x))));
  }

  async setPassword(password: string): Promise<this> {
    this.#key = await RawVault.#deriveVaultKey(
      await RawVault.#machineSeed,
      this.id,
      await this.#argonParams,
      password,
      (x) => this.addRevoker(x)
    );
    return this;
  }

  async load(deserialize: (_: Uint8Array) => Promise<void>): Promise<this> {
    if (!this.#key) throw new Error("can't load vault until key is set");
    const jwe = await idb.get(this.id, await RawVault.#vaultStore);
    if (!jwe) throw new Error("can't load missing vault");

    const decryptResult = await jose.flattenedDecrypt(jwe, this.#key, {
      keyManagementAlgorithms: ["A256KW"],
      contentEncryptionAlgorithms: ["A256GCM"],
    });
    this.meta.clear();
    const meta = decryptResult.protectedHeader?.meta;
    if (core.isIndexable(meta)) {
      Object.entries(meta).forEach(([k, v]) => this.meta.set(k, v));
    }
    await deserialize(decryptResult.plaintext);

    return this;
  }

  async save(serialize: () => Promise<Uint8Array>): Promise<this> {
    if (!this.#key) throw new Error("can't save vault until key is set");
    const payload = await serialize();
    //TODO: override the rng used by jose to calculate the CEK and IV with the dependency-injected one.
    const jwe = await new jose.FlattenedEncrypt(payload)
      .setProtectedHeader({
        alg: "A256KW",
        enc: "A256GCM",
        argon: await this.#argonParams,
        meta: Array.from(this.meta.entries()).reduce((a, [k, v]) => ((a[k] = v), a), {} as Record<string, unknown>),
      })
      .encrypt(this.#key);
    await idb.set(this.id, jwe, await RawVault.#vaultStore);
    return this;
  }
}

Object.freeze(RawVault);
Object.freeze(RawVault.prototype);
Object.freeze(Object.getPrototypeOf(RawVault));
