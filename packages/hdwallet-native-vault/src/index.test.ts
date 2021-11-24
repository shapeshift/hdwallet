import * as native from "@shapeshiftoss/hdwallet-native";
import * as idb from "idb-keyval";
import * as jose from "jose";
import * as uuid from "uuid";

import { Vault, GENERATE_MNEMONIC } from ".";
import { keyStoreUUID, vaultStoreUUID } from "./util";
import { deterministicGetRandomValues } from "./deterministicGetRandomValues.test";

const keyStore = idb.createStore(keyStoreUUID, "keyval");
const vaultStore = idb.createStore(vaultStoreUUID, "keyval");

jest.setTimeout(30 * 1000);

const realCrypto = require("crypto").webcrypto as Crypto;
let mockGetRandomValues: <T extends ArrayBufferView | null>(array: T) => Promise<T>;
async function resetGetRandomValues() {
  mockGetRandomValues = await deterministicGetRandomValues(realCrypto);
}

describe("Vault", () => {
  beforeAll(async () => {
    await resetGetRandomValues();
    await Vault.prepare({
      crypto: {
        subtle: realCrypto.subtle,
        async getRandomValues<T extends ArrayBufferView | null>(array: T): Promise<T> {
          return await mockGetRandomValues(array);
        },
      },
      performance: require("perf_hooks").performance,
    });
  });

  beforeEach(async () => {
    await resetGetRandomValues();
  });

  it("should only allow one call to Vault.prepare() with options", async () => {
    await expect(Vault.prepare()).resolves.not.toThrow();
    await expect(Vault.prepare({})).rejects.toThrowErrorMatchingInlineSnapshot(
      `"can't call prepare with a parameters object after vault is already prepared"`
    );
  });

  it("should create a new vault", async () => {
    expect((await Vault.list()).length).toBe(0);

    const vault = await Vault.create();
    await vault.setPassword("foobar");
    vault.set("foo", "bar");
    vault.meta.set("name", "default");
    expect(vault.meta.get("name")).toBe("default");
    await vault.save();

    expect((await Vault.list()).length).toBe(1);
    expect(vault.meta.get("name")).toBe("default");

    console.log(await idb.entries(keyStore));
    console.log(await idb.entries(vaultStore));
  });

  it("should open a vault", async () => {
    const vaultIDs = await Vault.list();
    expect(vaultIDs.length).toBe(1);
    const vault = await Vault.open(vaultIDs[0], "foobar");
    console.log(jose.decodeProtectedHeader((await idb.get(vaultIDs[0], vaultStore))!));
    console.log("entries", vault.entries());
    expect(await vault.get("foo")).toBe("bar");
    expect(uuid.validate(vault.id)).toBe(true);
    expect(vault.meta.size).toBe(1);
    expect(vault.meta.get("name")).toBe("default");
  });

  it("should store a mnemonic", async () => {
    const vault = await Vault.thereCanBeOnlyOne("foobar");
    vault.set("#mnemonic", "all all all all all all all all all all all all");
    await vault.save();
    const mnemonic = (await vault.get("#mnemonic")) as native.crypto.Isolation.Engines.Default.BIP39.Mnemonic;
    expect(mnemonic).toBeInstanceOf(native.crypto.Isolation.Engines.Default.BIP39.Mnemonic);
    expect(
      Buffer.from((await (await mnemonic.toSeed()).toMasterKey()).publicKey).toString("hex")
    ).toMatchInlineSnapshot(`"03e3b30e8c21923752a408242e069941fedbaef7db7161f7e2c5f3fdafe7e25ddc"`);
  });

  it("should retreive the mnemonic", async () => {
    const vaultIDs = await Vault.list();
    expect(vaultIDs.length).toBe(1);
    const vault = await Vault.open(vaultIDs[0], "foobar");
    const mnemonic = (await vault.get("#mnemonic")) as native.crypto.Isolation.Engines.Default.BIP39.Mnemonic;
    expect(mnemonic).toBeInstanceOf(native.crypto.Isolation.Engines.Default.BIP39.Mnemonic);
    expect(
      Buffer.from((await (await mnemonic.toSeed()).toMasterKey()).publicKey).toString("hex")
    ).toMatchInlineSnapshot(`"03e3b30e8c21923752a408242e069941fedbaef7db7161f7e2c5f3fdafe7e25ddc"`);
  });

  it("should store metadata", async () => {
    const vault = await Vault.thereCanBeOnlyOne("foobar");
    vault.meta.set("foo", "bar")
    expect(vault.meta.get("foo")).toBe("bar")
    await vault.save()
  })

  it("should retreive metadata from the vault instance", async () => {
    const vault = await Vault.thereCanBeOnlyOne("foobar");
    expect(vault.meta.get("foo")).toBe("bar")
  })

  it("should retreive metadata with the static method", async () => {
    const id = (await Vault.thereCanBeOnlyOne()).id;
    expect((await Vault.meta(id))?.get("foo")).toBe("bar")
  })

  it("should be unwrappable before being sealed", async () => {
    const vault = await Vault.thereCanBeOnlyOne("foobar", false);
    expect(vault.sealed).toBe(false);
    const unwrapped = vault.unwrap();
    expect(await unwrapped.get("#mnemonic")).toBe("all all all all all all all all all all all all");
  });

  describe("the unwrapped vault", () => {
    it("should expose the mnemonic via entries()", async () => {
      const vault = await Vault.thereCanBeOnlyOne("foobar", false);
      const unwrapped = vault.unwrap();
      const entries = await Promise.all(Array.from(unwrapped.entries()).map(async ([k, v]) => [k, await v]));
      expect(entries).toContainEqual(["#mnemonic", "all all all all all all all all all all all all"]);
    });
    it("should expose the mnemonic via values()", async () => {
      const vault = await Vault.thereCanBeOnlyOne("foobar", false);
      const unwrapped = vault.unwrap();
      const values = await Promise.all(Array.from(unwrapped.values()));
      expect(values).toContain("all all all all all all all all all all all all");
    });
  });

  it("should not be unwrappable after being sealed", async () => {
    const vault = await Vault.thereCanBeOnlyOne("foobar", false);
    expect(vault.sealed).toBe(false);
    vault.seal();
    expect(vault.sealed).toBe(true);
    expect(() => vault.unwrap()).toThrowErrorMatchingInlineSnapshot(`"can't unwrap a sealed vault"`);
  });

  it("should not return an unsealed vault from openDefault unless explicitly requested", async () => {
    const vault = await Vault.thereCanBeOnlyOne("foobar");
    expect(() => vault.unwrap()).toThrowErrorMatchingInlineSnapshot(`"can't unwrap a sealed vault"`);
  });

  it("should generate a fresh, random mnemonic when provided with the GENERATE_MNEMONIC magic", async () => {
    const vault = await Vault.create("foobar", false);
    expect(vault.id).toMatchInlineSnapshot(`"8f9c0a54-7157-42f7-87f1-361325aaf80a"`);
    vault.set("#mnemonic", GENERATE_MNEMONIC);
    await vault.save();

    const mnemonic = (await vault.get("#mnemonic")) as native.crypto.Isolation.Engines.Default.BIP39.Mnemonic;
    expect(mnemonic).toBeInstanceOf(native.crypto.Isolation.Engines.Default.BIP39.Mnemonic);
    expect(
      Buffer.from((await (await mnemonic.toSeed()).toMasterKey()).publicKey).toString("hex")
    ).toMatchInlineSnapshot(`"02576bde4c55b05886e56eeeeff304006352f935b6dfc1c409f7eae521dbc5558e"`);

    const unwrappedMnemonic = (await vault.unwrap().get("#mnemonic")) as string;
    expect(unwrappedMnemonic).toMatchInlineSnapshot(
      `"hover best act jazz romance ritual six annual pottery coral write paddle"`
    );
  });

  it("should retrieve the random mnemonic generated by the GENERATE_MNEMONIC magic", async () => {
    const vault = await Vault.open("8f9c0a54-7157-42f7-87f1-361325aaf80a", "foobar", false);

    const mnemonic = (await vault.get("#mnemonic")) as native.crypto.Isolation.Engines.Default.BIP39.Mnemonic;
    expect(mnemonic).toBeInstanceOf(native.crypto.Isolation.Engines.Default.BIP39.Mnemonic);
    expect(
      Buffer.from((await (await mnemonic.toSeed()).toMasterKey()).publicKey).toString("hex")
    ).toMatchInlineSnapshot(`"02576bde4c55b05886e56eeeeff304006352f935b6dfc1c409f7eae521dbc5558e"`);

    expect(await vault.unwrap().get("#mnemonic")).toMatchInlineSnapshot(
      `"hover best act jazz romance ritual six annual pottery coral write paddle"`
    );
  });
});
