import * as native from "@shapeshiftoss/hdwallet-native";
import * as idb from "idb-keyval";
import * as jose from "jose";
import * as uuid from "uuid";

import { Vault, GENERATE_MNEMONIC } from ".";
import { keyStore, vaultStore } from "./util";

describe("Vault", () => {
  beforeAll(async () => {
    await Vault.prepare();
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
    expect(vault.argonParams.parallelism).toBe(1);
    expect(vault.argonParams.memorySize).toBe(32768);
    expect(vault.argonParams.iterations).toBeGreaterThanOrEqual(1);
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

  it("should be unwrappable before being sealed", async () => {
    const vault = await Vault.thereCanBeOnlyOne("foobar", false);
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
    vault.seal();
    expect(() => vault.unwrap()).toThrowErrorMatchingInlineSnapshot(`"can't unwrap a sealed vault"`);
  });

  it("should not return an unsealed vault from openDefault unless explicitly requested", async () => {
    const vault = await Vault.thereCanBeOnlyOne("foobar");
    expect(() => vault.unwrap()).toThrowErrorMatchingInlineSnapshot(`"can't unwrap a sealed vault"`);
  });

  let generateMnemonicTestVaultId: string;
  let generateMnemonicTestMnemonic: string;
  let generateMnemonicTestPubkey: string;
  it("should generate a fresh, random mnemonic when provided with the GENERATE_MNEMONIC magic", async () => {
    const vault = await Vault.create("foobar", false);
    generateMnemonicTestVaultId = vault.id;
    vault.set("#mnemonic", GENERATE_MNEMONIC);
    await vault.save();

    const mnemonic = (await vault.get("#mnemonic")) as native.crypto.Isolation.Engines.Default.BIP39.Mnemonic;
    expect(mnemonic).toBeInstanceOf(native.crypto.Isolation.Engines.Default.BIP39.Mnemonic);
    generateMnemonicTestPubkey = Buffer.from((await (await mnemonic.toSeed()).toMasterKey()).publicKey).toString("hex");

    const unwrappedMnemonic = (await vault.unwrap().get("#mnemonic")) as string;
    console.log("this should be a new random mnemonic:", unwrappedMnemonic);
    generateMnemonicTestMnemonic = unwrappedMnemonic;
  });

  it("should retrieve the random mnemonic generated by the GENERATE_MNEMONIC magic", async () => {
    const vault = await Vault.open(generateMnemonicTestVaultId, "foobar", false);

    const mnemonic = (await vault.get("#mnemonic")) as native.crypto.Isolation.Engines.Default.BIP39.Mnemonic;
    expect(mnemonic).toBeInstanceOf(native.crypto.Isolation.Engines.Default.BIP39.Mnemonic);
    expect(Buffer.from((await (await mnemonic.toSeed()).toMasterKey()).publicKey).toString("hex")).toBe(
      generateMnemonicTestPubkey
    );

    expect(await vault.unwrap().get("#mnemonic")).toBe(generateMnemonicTestMnemonic);
  });
});
