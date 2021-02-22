import { default as util } from "./util";
import * as Isolation from "./crypto/isolation";

describe("getKeyPair", () => {
  const seed = (new Isolation.BIP39.Mnemonic("all all all all all all all all all all all all")).toSeed();

  it("should produce the key pair at m/1337/0", async () => {
    expect(util.getKeyPair(seed, [1337, 0])).toEqual({
      publicKey: "029bf8b52f7efe773323bf1746b8489c4e823adb73644476cc099df57b1be0cb94",
      privateKey: "89cd054013cc6badeb49baf2b287531317d33e4bc48c3fa5d1c6661ef054f6db",
    });
  });
});
