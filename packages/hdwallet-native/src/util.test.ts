import { default as util } from "./util";
import * as Isolation from "./crypto/isolation";

describe("getKeyPair", () => {
  const seed = (new Isolation.Engines.Dummy.BIP39.Mnemonic("all all all all all all all all all all all all")).toSeed();

  it("should produce the key pair at m/1337/0", async () => {
    const keyPair = util.getKeyPair(seed, [1337, 0], "bitcoin");
    expect(keyPair.publicKey.toString("hex")).toEqual("029bf8b52f7efe773323bf1746b8489c4e823adb73644476cc099df57b1be0cb94");
  });
});
