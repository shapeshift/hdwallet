import * as Isolation from "./crypto/isolation";
import * as util from "./util";

describe("getKeyPair", () => {
  let masterKey: Isolation.Core.BIP32.Node;

  beforeAll(async () => {
    const mnemonic = await Isolation.Engines.Default.BIP39.Mnemonic.create(
      "all all all all all all all all all all all all"
    );
    const seed = await mnemonic.toSeed();
    masterKey = await seed.toMasterKey();
  });

  it("should produce the key pair at m/1337/0", async () => {
    const keyPair = await util.getKeyPair(masterKey, [1337, 0], "bitcoin");
    expect(keyPair.publicKey.toString("hex")).toEqual(
      "029bf8b52f7efe773323bf1746b8489c4e823adb73644476cc099df57b1be0cb94"
    );
  });
});
