import * as Core from "../../core";
import * as Dummy from "./";

describe("Isolation.Engines.Dummy", () => {
  let mnemonic: Core.BIP39.Mnemonic;
  let seed: Core.BIP32.Seed;
  let masterKey: Core.BIP32.Node;

  it("can be loaded with a list of xpubs", async () => {
    mnemonic = await Dummy.BIP39.Mnemonic.create([
      "xpub661MyMwAqRbcFLgDU7wpcEVubSF7NkswwmXBUkDiGUW6uopeUMys4AqKXNgpfZKRTLnpKQgffd6a2c3J8JxLkF1AQN17Pm9QYHEqEfo1Rsx", // all seed root key
      "xpub68Zyu13qjcQxDzLNfTYnUXtJuX2qJgnxP6osrcAvJGdo6bs9M2Adt2BunbwiYrZS5qpA1QKoMf3uqS2NHpbyZp4KMJxDrL58NTyvHXBeAv6", // all seed m/44'
      "xpub6APRH5kELakva27TFbzpfhfsY3Jd4dRGo7NocHb63qWecSgK2dUkjWaYevJsCunicpdAkPg9fvHAdpSFMDCMCDMit8kiTM1w9QoGmfyVwDo", // all seed m/44'/0'
      "xpub6BiVtCpG9fQPxnPmHXG8PhtzQdWC2Su4qWu6XW9tpWFYhxydCLJGrWBJZ5H6qTAHdPQ7pQhtpjiYZVZARo14qHiay2fvrX996oEP42u8wZy", // all seed m/44'/0'/0'
      "xpub6APRH5kELakyDsZMmBU9HEoeRUzM9F8STp6ztXLPUJQLiXGrbsfACbngkw5vySPfa9vFs2p3kMsRPxhyDTLhKYEf5HLVfDcDuTTazgzvArk", // all seed m/44'/60'
      "xpub6CNFa58kEQJu2hwMVoofpDEKVVSg6gfwqBqE2zHAianaUnQkrJzJJ42iLDp7Dmg2aP88qCKoFZ4jidk3tECdQuF4567NGHDfe7iBRwHxgke", // all seed m/44'/60'/0'
      "xpub68Zyu13qjcQxUZiesSWiHJMqkg8G8Guft6MvDhwP72zSYXr9iKnNmDo7LxuSVwtpamrNwGQHkGDWoK8MAp3S9GW5fVxsjBY6AdvZc1hB7kK", // all seed m/49'
      "xpub6AA5piovovuKytxa5QtBWAbixSjg7fbmu5gqs6QmvARrUMgewJV51roNH4M7GtvZmjBY1m5oAgAjoHivasewSh4S2H7LAikCyuhJxfHdSsK", // all seed m/49'/0'
      "xpub6CVKsQYXc9awxgV1tWbG4foDvdcnieK2JkbpPEBKB5WwAPKBZ1mstLbKVB4ov7QzxzjaxNK6EfmNY5Jsk2cG26EVcEkycGW4tchT2dyUhrx", // all seed m/49'/0'/0'
      "xpub68Zyu13qjcQz2DTzkBfLNCfsCTgT39rsUY9JT7MFvG3oEJvS8gUYwRX4RheUTFGZ6EtW4dFYhCdBX32GHJCodkQLAARjNsw4Drj1oDxvo9p", // all seed m/84'
      "xpub69s3dQnszuX49hTwhNAQEMJyTcRQNZyhtKAqNgQXApquzXdR3fEjXg75ScXzMMMLkUjQnz2Giwt2L7vesiswkAYwzbHezaUXayU8Z81CW56", // all seed m/84'/0'
      "xpub6DDUPHpUo4pcy43iJeZjbSVWGav1SMMmuWdMHiGtkK8rhKmfbomtkwW6GKs1GGAKehT6QRocrmda3WWxXawpjmwaUHfFRXuKrXSapdckEYF", // all seed m/84'/0'/0'
    ].join(" "));
  });

  it("produces a seed", async () => {
    seed = await mnemonic.toSeed();
  })

  it("produces a master key", async () => {
    masterKey = await seed.toMasterKey();
    const pk = await masterKey.getPublicKey()
    expect(Buffer.from(pk).toString("hex")).toEqual("03e3b30e8c21923752a408242e069941fedbaef7db7161f7e2c5f3fdafe7e25ddc");
  })

  it.each([
    ["m/44'", "034d600165882b6faf32a3f1f2c4755eeb0f0486954718d46fd9621e8ca40ca6b6"],
    ["m/44'/0'", "03dde722d51529c6744d45e1a5e644c6e27520bd8bc7278fbeb1f43094f3dce91a"],
    ["m/44'/0'/0'", "03c8166eb40ac84088b618ec07c7cebadacee31c5f5b04a1e8c2a2f3e748eb2cdd"],
    ["m/44'/0'/0'/0", "02d3f906cd22167506f94331fc879b1757695c9d9b09fbb1cd6bee9c7ee7019751"],
    ["m/44'/0'/0'/0/0", "03c6d9cc725bb7e19c026df03bf693ee1171371a8eaf25f04b7a58f6befabcd38c"],
    ["m/44'/0'/0'/0/1", "02c651a011009e2c7e7b3ed2068857ca0a47cba35b73e06c32e3c06ef3aa67621d"],
    ["m/44'/0'/0'/0/2", "03330236b68aa6fdcaca0ea72e11b360c84ed19a338509aa527b678a7ec9076882"],
    ["m/44'/0'/0'/1", "0377d49f78af126571d0e995656ab0b12cf149a6761bfc3e75132813c7d9c1739f"],
    ["m/44'/0'/0'/1/0", "035bc524b005abbf8c3f0c22a452d0b9c2ad43c4609b4b78c745b47f66120bb1a0"],
    ["m/44'/0'/0'/1/1", "0203ae8dbf9f9b65f3922a4a855a7c5d7e7700b0f38477b9e047385eed1ba6e18c"],
    ["m/44'/0'/0'/1/2", "03389aa9b8d59b776a93a26cf7ee3d9e0ad1b8f0440e778f5270785d12936dad3c"],
    ["m/44'/60'", "026efeb8a29b3eedec94c5aca20a84ff4b98d57f9967856a21a64c8d127d863098"],
    ["m/44'/60'/0'", "03d92dfaf121b2723d0e6dabb2637b2d9b2b3b2d8026ab901f2df3eea3f6d200c9"],
    ["m/44'/60'/0'/0", "0217ebaac6b4c12d3c7e0fc21d8d53d89adf007ff7988840926032c89eb966a37c"],
    ["m/44'/60'/0'/0/0", "03ad8e7eb4f3a7d1a409fa7bdc7b79d8840fe746d3fa9ee17fee4f84631ec1430b"],
    ["m/49'", "02afb083c2e97455310c8591c6235c9ceb92dc32f4e40d146cd5b550e3bebbc74a"],
    ["m/49'/0'", "039051bb3f5af2094a2b4ee31964b8d82b379604926b393b698314e098b6984bd0"],
    ["m/49'/0'/0'", "0215a09870bbb713f1ba94d364e1e5bfcf9cdb5178d22efbca6ec17dc2c4f706cd"],
    ["m/49'/0'/0'/0", "020ddd7e4206daf889a2c11920fcccbb60df383d4c5fcd982cd5c7d400fdd46c8e"],
    ["m/49'/0'/0'/0/0", "02f770feae292b5b3f41d8c81220c2568cb73eb8042def35e648dfe048e4b41b11"],
    ["m/49'/0'/0'/0/1", "02dc4843f2fbef594a8c41573ca7a91c968ced334c16c5200cc6a07e8dbba3bdb2"],
    ["m/49'/0'/0'/0/2", "03eb2d79f0e0896f523a30d92f395e31c31d0196f2f36d8284145007e68d0563fa"],
    ["m/49'/0'/0'/1", "02f7ff3aab4f9fd88190ac153bd0bcb26758a6b3b75480ddda8c0f43147fbbee95"],
    ["m/49'/0'/0'/1/0", "03a961687895a78da9aef98eed8e1f2a3e91cfb69d2f3cf11cbd0bb1773d951928"],
    ["m/49'/0'/0'/1/1", "03f459101133e88e5953ec0a128c3bc17d5e6e7e8dd035b4dbffad364774f1e710"],
    ["m/49'/0'/0'/1/2", "036a7e2f1544eb4ddf1e3df4fedd4c8c0c39b988f3ac99e927f4a00fc5fddfc653"],
    ["m/84'", "0225ee2bad1901cea8dca61028fa2c39f9bc6fe6fde7f06405c4cf1131e0ec91ae"],
    ["m/84'/0'", "031c9a1c04f0c3b62c013e27ce7a6c7720ac669ee738aa4a6c9112f25d731b6c27"],
    ["m/84'/0'/0'", "03e36a4f3fee21bfe83447b209d8de6da1ce1ae38f76bc2c00652dc5e0a8c5c0b5"],
    ["m/84'/0'/0'/0", "025982bc036c5321d35d808ab872b2337438b1bb07d5544cf0a20e84327e05897f"],
    ["m/84'/0'/0'/0/0", "0396070f2813933502e907c011ae7ba928683a9c2f0e888dae7ebd2c41120ee6b5"],
    ["m/84'/0'/0'/0/1", "026b6039331b4d7bb2037fe72411a582e3d1993190731582bf04f18cc4249ea83e"],
    ["m/84'/0'/0'/0/2", "03e4a361a06cdf253f7be2b00bb171e30f6f73ec06eb437d9842ec593c5ac0e499"],
    ["m/84'/0'/0'/1", "03bc5bf5297765cd1675cd93667500529476502a413310afbfdeb04963e130ea3e"],
    ["m/84'/0'/0'/1/0", "032ef68318c8f6aaa0adec0199c69901f0db7d3485eb38d9ad235221dc3d61154b"],
    ["m/84'/0'/0'/1/1", "02768afac47832d02e24c39ffcaa9bbd54be67460e38c255d97192cec5e4e25975"],
    ["m/84'/0'/0'/1/2", "0245ac2db850ba9a1971741267a1849c72b91722e09cf71c9ff3754ff41f2a0419"],
  ])("derives the key at %s", async (path: string, expectedPk: string) => {
    const node = await Core.BIP32.derivePath(masterKey, path);
    const pk = Buffer.from(await node.getPublicKey()).toString("hex");
    expect(pk).toEqual(expectedPk);
  });
})
