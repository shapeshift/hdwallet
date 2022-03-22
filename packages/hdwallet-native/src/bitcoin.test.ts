import * as core from "@shapeshiftoss/hdwallet-core";
import cloneDeep from "lodash/cloneDeep";

import * as native from "./native";
import * as Networks from "./networks";

const MNEMONIC = "all all all all all all all all all all all all";

const mswMock = require("mswMock")().startServer();
afterEach(() => expect(mswMock).not.toHaveBeenCalled());

const untouchable = require("untouchableMock");

function benchmarkTx(
  inPath: string,
  inScriptType: string,
  inTxId: string,
  inVout: number,
  inAmount: string,
  inputExtra: object,
  outAddr: string,
  outAmount: string,
  outExtra: object = {}
): core.BTCSignTx {
  return {
    coin: "Bitcoin",
    inputs: [
      {
        addressNList: core.bip32ToAddressNList(inPath),
        scriptType: inScriptType as any,
        amount: inAmount,
        vout: inVout,
        txid: inTxId,
        ...inputExtra,
      } as any,
    ],
    outputs: [
      {
        address: outAddr,
        addressType: core.BTCOutputAddressType.Spend,
        amount: outAmount,
        isChange: false,
      },
    ],
    ...outExtra,
  };
}

// Funding Tx: https://api.blockcypher.com/v1/btc/main/txs/350eebc1012ce2339b71b5fca317a0d174abc3a633684bc65a71845deb596539?includeHex=true
// Spending Tx: https://api.blockcypher.com/v1/btc/main/txs/1869cdbb3a86ab8b71a3e4a0d11135926b18f62bc0ebeb8e8a56635135616f00?includeHex=true
const BIP44_BENCHMARK_TX_INPUT_TXID = "350eebc1012ce2339b71b5fca317a0d174abc3a633684bc65a71845deb596539";
const BIP44_BENCHMARK_TX_INPUT_HEX =
  "0100000001ac941afec3d31edd772cf45647c2c97b25b1dbfbc0045a83ca3658942a155619010000006a47304402206c8e9ce1116842cb0ea8d1e2a07d930b3692ea36964251fc453cb0b51d281b5002203b493db783d69eaad775f3b0ee2a6855dffab3977fb68a3a34a1c067716f1fb2012103fa9122a96ca4223ab9518db03fb600bbb59de61dbd4b8ae587cd3e7b9f968764ffffffff02a0860100000000001976a914bc4c06f0e7da28b37ee22fc9c93e2bb7bd8f305c88ac20dac100000000001976a9143435bb2ebfe441f268fd5a7933f43f28d2a3dfe288ac00000000";
const BIP44_BENCHMARK_TX_OUTPUT_ADDR = "1MCgrVZjXRJJJhi2Z6SR11GpRjCyvNjscY";
const BIP44_BENCHMARK_TX_OUTPUT =
  "0100000001396559eb5d84715ac64b6833a6c3ab74d1a017a3fcb5719b33e22c01c1eb0e35000000006a47304402203b727eb80b3bac3b23bb88e8a22a77eb5232dd4bf079cb1520769a1eca88d96302201e36cf5919f17eb61ef87b8e5f1dc684df98a42f58e815f002b7dcc6c665ee0d012103c6d9cc725bb7e19c026df03bf693ee1171371a8eaf25f04b7a58f6befabcd38cffffffff01b8820100000000001976a914dd985beff82366763a5d86dd8c61b98d3f79590b88ac00000000";
const BIP44_BENCHMARK_TX_OUTPUT_SIG = BIP44_BENCHMARK_TX_OUTPUT.slice(86, 86 + 140);
const BIP44_BENCHMARK_TX = benchmarkTx(
  "m/44'/0'/0'/0/0",
  "p2pkh",
  BIP44_BENCHMARK_TX_INPUT_TXID,
  0,
  "100000",
  { hex: BIP44_BENCHMARK_TX_INPUT_HEX },
  BIP44_BENCHMARK_TX_OUTPUT_ADDR,
  "99000"
);

// Funding Tx: https://api.blockcypher.com/v1/btc/main/txs/918f59f7144fa389f66b6776e3417e1ec356214e18684050237acc056d5efbc1?includeHex=true
// Spending Tx: https://api.blockcypher.com/v1/btc/main/txs/6e6ad85c99bfb6ed7c0fa3ec99af02dfcdb805aeda36674bbeb3960bfc6418ba?includeHex=true
const BIP49_BENCHMARK_TX_INPUT_TXID = "918f59f7144fa389f66b6776e3417e1ec356214e18684050237acc056d5efbc1";
// (We're not using it but this is real on-chain data we don't want to lose track of)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const BIP49_BENCHMARK_TX_INPUT_HEX =
  "01000000015c4813fb3e0203e3bfa21420d62f88d2f89d39a63fde0f6ef2b08c406bda5f7f000000006a47304402205c9c26e213470dcb1c6b9399cb6cfda2c2dfece806ef10d6e5a889e39bc2e201022027d07373261478c4c43fa7044d6128f48a496cb8c97b93e4460887c664e0ef960121022a6e02f34ea72544c24f96cde286916d162de1f448396c62943b72ea16e6fb47ffffffff028f8011f8000000001976a914d32f4064914d28c30f5b309a73435588e0161f7b88ac2a5d00000000000017a914c9e193b1af9e4349d2ee53b4190e2bd36e59719e8700000000";
const BIP49_BENCHMARK_TX_OUTPUT_ADDR = "1EC9SktW9Y4kS4iW48idshNg9eNeBdY5Xi";
const BIP49_BENCHMARK_TX_OUTPUT =
  "01000000000101c1fb5e6d05cc7a23504068184e2156c31e7e41e376676bf689a34f14f7598f910100000017160014ef01be1e6c7709df95c0ed763aa3b845286bbe80ffffffff01a25c0000000000001976a91490b54270b8fb85ade07261e9edc99f96fd197de588ac02483045022100ee6c831ceb78d97d1e0c24d0de62a4e87494a436157a7f2291065523f3f673f9022055b24caa363a8c51a7ed9dce546e25aefbcf9af7a08f2ed63a3bf37c9978c167012102f770feae292b5b3f41d8c81220c2568cb73eb8042def35e648dfe048e4b41b1100000000";
const BIP49_BENCHMARK_TX_OUTPUT_SIG = BIP49_BENCHMARK_TX_OUTPUT.slice(216, 216 + 144);
const BIP49_BENCHMARK_TX = benchmarkTx(
  "m/49'/0'/0'/0/0",
  "p2sh-p2wpkh",
  BIP49_BENCHMARK_TX_INPUT_TXID,
  1,
  "23850",
  {
    // Using tx.vout instead of hex tests another code path
    /*hex: BIP49_BENCHMARK_TX_INPUT_HEX,*/
    tx: {
      vout: [undefined, { scriptPubKey: { hex: "a914c9e193b1af9e4349d2ee53b4190e2bd36e59719e87" } }],
    },
  },
  BIP49_BENCHMARK_TX_OUTPUT_ADDR,
  "23714"
);

// Funding Tx: https://api.blockcypher.com/v1/btc/main/txs/fa80a9949f1094119195064462f54d0e0eabd3139becd4514ae635b8c7fe3a46?includeHex=true
// Spending Tx: https://api.blockcypher.com/v1/btc/main/txs/7e58757f43015242c0efa29447bea4583336f2358fdff587b52bbe040ad8982a?includeHex=true
const BIP84_BENCHMARK_TX_INPUT_TXID = "fa80a9949f1094119195064462f54d0e0eabd3139becd4514ae635b8c7fe3a46";
const BIP84_BENCHMARK_TX_INPUT_HEX =
  "01000000000101360d7a720e95a6068678eb08e91b3a8a4774222c9f34becf57d0dc4329e0a686000000001716001495f41f5c0e0ec2c7fe27f0ac4bd59a5632a40b5fffffffff02d224000000000000160014ece6935b2a5a5b5ff997c87370b16fa10f16441088ba04000000000017a914dfe58cc93d35fb99e15436f47d3bbfce820328068702483045022100f312e8246e6a00d21fd762f12231c5fb7a20094a32940b9a84e28d712a5ced9b02203b9124d7a94aa7eb1e090ceda32e884511d7068b8d47593aa46537900e3e37d40121037e8bf05c6c7223cfba3ea484ecd61ee910ae38609ea89b4a4839beed2186b3fb00000000";
const BIP84_BENCHMARK_TX_OUTPUT_ADDR = "36JkLACrdxARqXXffZk91V9W6SJvghKaVK";
const BIP84_BENCHMARK_TX_OUTPUT =
  "01000000000101463afec7b835e64a51d4ec9b13d3ab0e0e4df562440695911194109f94a980fa0000000000ffffffff01611900000000000017a91432a276261d6f084fa46917300b6be8848853211187024730440220200b1192c3d49338678bdb30678fa270720e7ff1de4f45d5340a0cb7fbf8f2de02202457250ae49f088fc9d9663db8c92db4606dc25b098874ed7bb548d3002c346f01210396070f2813933502e907c011ae7ba928683a9c2f0e888dae7ebd2c41120ee6b500000000";
const BIP84_BENCHMARK_TX_OUTPUT_SIG = BIP84_BENCHMARK_TX_OUTPUT.slice(166, 166 + 142);
const BIP84_BENCHMARK_TX = benchmarkTx(
  "m/84'/0'/0'/0/0",
  "p2wpkh",
  BIP84_BENCHMARK_TX_INPUT_TXID,
  0,
  "9426",
  { hex: BIP84_BENCHMARK_TX_INPUT_HEX },
  BIP84_BENCHMARK_TX_OUTPUT_ADDR,
  "6497"
);

// Funding Tx: https://api.blockcypher.com/v1/btc/main/txs/799a8923515e0303b15dda074b8341b2cf5efab946fce0d68a6614f32a8fc935?includeHex=true
// Spending Tx: https://api.blockcypher.com/v1/btc/main/txs/8841a6007c2a01376260c3dfa1469d5f215de310aaed72e0a300c88ecc9d11b9?includeHex=true
const OP_RETURN_BENCHMARK_TX_INPUT_TXID = "799a8923515e0303b15dda074b8341b2cf5efab946fce0d68a6614f32a8fc935";
const OP_RETURN_BENCHMARK_TX_INPUT_HEX =
  "01000000000102303a686b8bca00ebb484919f11addd3b2787cc26e1b2d3cd0f12af83623a3c210100000017160014838e24a1d99c435bde880e4dbc283c7ae1f7859cffffffff30b2fba7ee86f9de44bda798b70e7118e671e5ab8dc499da23b62156d46362510000000017160014e4540cd724d36d6dc3fa913f9fc4b476ff6aad13ffffffff023075000000000000160014ece6935b2a5a5b5ff997c87370b16fa10f1644104e0f00000000000017a9146d24979924837c0699c8abc91fe02907f2b992a48702483045022100ab0d3ad7fee9a20dac59fa70a4f6156ef9f725c841406ee722724e4d1084048302206a091bc9758b9205fc3c53f355e81c20d0d52cbaa17445865e56bd576c107eac012102cf98f208e8d659bd49127013a80d8ffb43931b8ebfad65fe0292ca48593ed31c02473044022070c0adba6d23521d8583d59769f7ec448c2188cc2bff6d16ab47ad02c10dc37e02204527a6c46f52782fe79e2a5964bafdd4ecd56c3d59e2bd42aaf907dcdef34a76012103c5412363b7a052398d213c79895f0d00f3237b86a354267697b75530664c0fce00000000";
const OP_RETURN_BENCHMARK_TX_OUTPUT_ADDR = "38hU3uzGmB5ST37DW8SwvdhiWE7zvZPsyf";
const OP_RETURN_BENCHMARK_TX_OUTPUT =
  "0100000000010135c98f2af314668ad6e0fc46b9fa5ecfb241834b07da5db103035e5123899a790000000000ffffffff02a86100000000000017a9144cdeb0b5d429c2589fef2d6d088fce317f8dac44870000000000000000086a06666f6f62617202483045022100eb59a33fd25396ba5494aefb2a37be5c1956718815bd9404800ac274c2c937da02202a3b5e9796a1c8fc03be3a01bc0cdfb56b1002658b45abd7ca4a7d18bad3b9c101210396070f2813933502e907c011ae7ba928683a9c2f0e888dae7ebd2c41120ee6b500000000";
const OP_RETURN_BENCHMARK_TX_OUTPUT_SIG = OP_RETURN_BENCHMARK_TX_OUTPUT.slice(200, 200 + 144);
const OP_RETURN_BENCHMARK_TX = benchmarkTx(
  "m/84'/0'/0'/0/0",
  "p2wpkh",
  OP_RETURN_BENCHMARK_TX_INPUT_TXID,
  0,
  "30000",
  { hex: OP_RETURN_BENCHMARK_TX_INPUT_HEX },
  OP_RETURN_BENCHMARK_TX_OUTPUT_ADDR,
  "25000",
  { opReturnData: "foobar" }
);

describe("NativeBTCWalletInfo", () => {
  const info = native.info();

  it("should return some static metadata", async () => {
    expect((info as any)["btcSupportsNetwork"]).not.toBeDefined();
    expect(await untouchable.call(info, "btcSupportsSecureTransfer")).toBe(false);
    expect(untouchable.call(info, "btcSupportsNativeShapeShift")).toBe(false);
  });

  it("should return some dynamic metadata", async () => {
    expect(await info.btcSupportsCoin("bitcoin")).toBe(true);
    expect(await info.btcSupportsCoin("bitcoincash")).toBe(true);
    expect(await info.btcSupportsScriptType("bitcoin", "p2pkh" as any)).toBe(true);
    expect(await info.btcSupportsScriptType("bitcoin", "p2sh" as any)).toBe(true);
    expect(await info.btcSupportsScriptType("bitcoin", "p2wpkh" as any)).toBe(true);
    expect(await info.btcSupportsScriptType("bitcoin", "p2sh-p2wpkh" as any)).toBe(true);
    expect(await info.btcSupportsScriptType("bitcoin", "bech32" as any)).toBe(true);
    expect(await info.btcSupportsScriptType("bitcoin", "cashaddr" as any)).toBe(false);
    expect(await info.btcSupportsScriptType("bitcoincash", "cashaddr" as any)).toBe(false);
    expect(await info.btcSupportsScriptType("bitcoin", "foobar" as any)).toBe(false);
    expect(await info.btcSupportsScriptType("foobar", "p2pkh" as any)).toBe(false);
  });

  it("should not do anything when btcIsSameAccount is called", async () => {
    expect(untouchable.call(info, "btcIsSameAccount", [])).toBe(false);
  });

  it.each([
    [
      "an undefined scriptType",
      "Bitcoin",
      undefined,
      0,
      [
        {
          coin: "Bitcoin",
          scriptType: "p2pkh",
          addressNList: core.bip32ToAddressNList("m/44'/0'/0'"),
        },
        {
          coin: "Bitcoin",
          scriptType: "p2sh-p2wpkh",
          addressNList: core.bip32ToAddressNList("m/49'/0'/0'"),
        },
        {
          coin: "Bitcoin",
          scriptType: "p2wpkh",
          addressNList: core.bip32ToAddressNList("m/84'/0'/0'"),
        },
      ],
    ],
    [
      "BIP44",
      "Bitcoin",
      "p2pkh",
      1337,
      [
        {
          coin: "Bitcoin",
          scriptType: "p2pkh",
          addressNList: core.bip32ToAddressNList("m/44'/0'/1337'"),
        },
      ],
    ],
    [
      "BIP49",
      "Bitcoin",
      "p2sh-p2wpkh",
      1337,
      [
        {
          coin: "Bitcoin",
          scriptType: "p2sh-p2wpkh",
          addressNList: core.bip32ToAddressNList("m/49'/0'/1337'"),
        },
      ],
    ],
    [
      "BIP84",
      "Bitcoin",
      "p2wpkh",
      1337,
      [
        {
          coin: "Bitcoin",
          scriptType: "p2wpkh",
          addressNList: core.bip32ToAddressNList("m/84'/0'/1337'"),
        },
      ],
    ],
  ])("should return the correct account paths for %s", (_, coin, scriptType: any, accountIdx, out) => {
    expect(info.btcGetAccountPaths({ coin, scriptType, accountIdx })).toMatchObject(out);
  });

  it("should not return any account paths for a bad coin type", () => {
    expect(
      info.btcGetAccountPaths({
        coin: "foobar",
        accountIdx: 0,
      })
    ).toMatchObject([]);
  });

  describe("btcNextAccountPath", () => {
    it.each([
      ["BIP44", "Bitcoin", "p2pkh", "m/44'/0'/0'", "m/44'/0'/1'"],
      ["BIP44", "Bitcoin", "p2pkh", "m/44'/0'/1337'", "m/44'/0'/1338'"],
      ["BIP49", "Bitcoin", "p2sh-p2wpkh", "m/49'/0'/0'", "m/49'/0'/1'"],
      ["BIP84", "Bitcoin", "p2wpkh", "m/84'/0'/0'", "m/84'/0'/1'"],
      ["Bitcoin Cash", "BitcoinCash", "p2pkh", "m/44'/145'/1337'", "m/44'/145'/1338'"],
    ])("should work for %s", (_, coin, scriptType: any, inPath, outPath) => {
      expect(
        info.btcNextAccountPath({
          coin,
          scriptType,
          addressNList: core.bip32ToAddressNList(inPath),
        })
      ).toMatchObject({
        coin,
        scriptType,
        addressNList: core.bip32ToAddressNList(outPath),
      });
    });

    it.each([
      ["BIP44 with p2sh-p2wpkh scripts", "Bitcoin", "p2sh-p2wpkh", "m/44'/0'/0'"],
      ["BIP44 with p2wpkh scripts", "Bitcoin", "p2wpkh", "m/44'/0'/0'"],
      ["BIP49 with p2pkh scripts", "Bitcoin", "p2pkh", "m/49'/0'/0'"],
      ["BIP49 with p2wpkh scripts", "Bitcoin", "p2wpkh", "m/49'/0'/0'"],
      ["BIP84 with p2pkh scripts", "Bitcoin", "p2pkh", "m/84'/0'/0'"],
      ["BIP84 with p2sh-p2wpkh scripts", "Bitcoin", "p2sh-p2wpkh", "m/84'/0'/0'"],
      ["an unrecognized path", "Bitcoin", "p2pkh", "m/1337'/0'/0'"],
      ["a lowercase coin name", "bitcoin", "p2pkh", "m/44'/0'/0'"],
      ["a bad coin name", "foobar", "p2pkh", "m/44'/0'/0'"],
      ["a bad script type name", "Bitcoin", "foobar", "m/44'/0'/0'"],
    ])("should not work for %s", (_, coin, scriptType: any, path) => {
      expect(
        info.btcNextAccountPath({
          coin,
          scriptType,
          addressNList: core.bip32ToAddressNList(path),
        })
      ).toBeUndefined();
    });

    it.each([
      ["BIP44", "m/44'/0'/0'/0/0", "p2pkh"],
      ["BIP49", "m/49'/0'/0'/0/0", "p2sh-p2wpkh"],
      ["BIP84", "m/84'/0'/0'/0/0", "p2wpkh"],
    ])("should not work for a %s path with an unrecognized purpose field", (_, path, scriptType: any) => {
      const mock = jest
        .spyOn(core, "describeUTXOPath")
        .mockReturnValue(core.describeUTXOPath(core.bip32ToAddressNList(path), "Bitcoin", scriptType));
      expect(
        info.btcNextAccountPath({
          coin: "Bitcoin",
          scriptType,
          addressNList: core.bip32ToAddressNList("m/1337'/0'/0'/0/0"),
        })
      ).toBeUndefined();
      mock.mockRestore();
    });
  });
});

describe("NativeBTCWallet", () => {
  let wallet: native.NativeHDWallet;

  beforeEach(async () => {
    wallet = native.create({ deviceId: "native" });
    await wallet.loadDevice({ mnemonic: MNEMONIC });
    expect(await wallet.initialize()).toBe(true);
  });

  it.each([
    [
      "BIP44",
      "Bitcoin",
      "p2pkh",
      [
        ["m/44'/0'/0'/0/0", "1JAd7XCBzGudGpJQSDSfpmJhiygtLQWaGL"],
        ["m/44'/0'/1337'/123/4", "12EgVaC3wL5rVczoMfTwJWpZ2v783cptjs"],
      ],
    ],
    [
      "BIP49",
      "Bitcoin",
      "p2sh-p2wpkh",
      [
        ["m/49'/0'/0'/0/0", "3L6TyTisPBmrDAj6RoKmDzNnj4eQi54gD2"],
        ["m/49'/0'/1337'/123/4", "3CXezZxPpvNMriYWXUHYuxAByUXpANWMzb"],
      ],
    ],
    [
      "BIP84",
      "Bitcoin",
      "p2wpkh",
      [
        ["m/84'/0'/0'/0/0", "bc1qannfxke2tfd4l7vhepehpvt05y83v3qsf6nfkk"],
        ["m/84'/0'/1337'/123/4", "bc1q9sjm947kn2hz84syykmem7dshvevm8xm5dkrpg"],
      ],
    ],
    [
      "Bitcoin Cash",
      "BitcoinCash",
      // maybe "cashaddr" should work here, but it doesn't.
      "p2pkh",
      [
        ["m/44'/145'/0'/0/0", "bitcoincash:qr08q88p9etk89wgv05nwlrkm4l0urz4cyl36hh9sv"],
        ["m/44'/145'/1337'/123/4", "bitcoincash:qzrgv3veuqtu9g345w3hz8kwx796ty6vuu7hqstryu"],
      ],
    ],
  ])("should generate correct %s addresses", async (_, coin, scriptType: any, addrSpec) => {
    for (const [path, addr] of addrSpec) {
      expect(await wallet.btcGetAddress({ coin, scriptType, addressNList: core.bip32ToAddressNList(path) })).toBe(addr);
    }
  });

  it("does not support p2sh addresses", async () => {
    await expect(
      wallet.btcGetAddress({
        coin: "Bitcoin",
        scriptType: "p2sh" as any,
        addressNList: core.bip32ToAddressNList("m/44'/0'/0'/0/0"),
      })
    ).rejects.toThrowErrorMatchingInlineSnapshot(`"Not enough data"`);
  });

  it("should not generate addresses for bad script types", async () => {
    const mock = jest.spyOn(Networks, "getNetwork").mockReturnValue(Networks.getNetwork("bitcoin", "p2pkh" as any));
    await expect(
      wallet.btcGetAddress({
        coin: "Bitcoin",
        scriptType: "foobar" as any,
        addressNList: core.bip32ToAddressNList("m/44'/0'/0'/0/0"),
      })
    ).rejects.toThrowError("no implementation for script type");
    mock.mockRestore();
  });

  it("should sign a BIP44 transaction correctly", async () => {
    const input = BIP44_BENCHMARK_TX;
    const out = await wallet.btcSignTx(input);
    expect(out?.signatures).toMatchObject([BIP44_BENCHMARK_TX_OUTPUT_SIG]);
    expect(out?.serializedTx).toBe(BIP44_BENCHMARK_TX_OUTPUT);
  });

  it("should sign a BIP49 transaction correctly", async () => {
    const input = BIP49_BENCHMARK_TX;
    const out = await wallet.btcSignTx(input);
    expect(out?.signatures).toMatchObject([BIP49_BENCHMARK_TX_OUTPUT_SIG]);
    expect(out?.serializedTx).toBe(BIP49_BENCHMARK_TX_OUTPUT);
  });

  it("should sign a BIP84 transaction correctly", async () => {
    const input = BIP84_BENCHMARK_TX;
    const out = await wallet.btcSignTx(input);

    expect(out?.signatures).toMatchObject([BIP84_BENCHMARK_TX_OUTPUT_SIG]);
    expect(out?.serializedTx).toBe(BIP84_BENCHMARK_TX_OUTPUT);
  });

  it("should sign a BIP84 transaction with an OP_RETURN message correctly", async () => {
    const input = OP_RETURN_BENCHMARK_TX;
    const out = await wallet.btcSignTx(input);

    expect(out?.signatures).toMatchObject([OP_RETURN_BENCHMARK_TX_OUTPUT_SIG]);
    expect(out?.serializedTx).toBe(OP_RETURN_BENCHMARK_TX_OUTPUT);
  });

  it("should not sign a transaction without having the raw input transaction", async () => {
    const input = cloneDeep(BIP44_BENCHMARK_TX);
    delete (input.inputs[0] as any).hex;
    await expect(wallet.btcSignTx(input)).rejects.toThrowError("must provide prev rawTx");
  });

  it("should sign a transaction with a locktime correctly", async () => {
    const input = {
      locktime: 338841,
      ...BIP44_BENCHMARK_TX,
    };

    const locktimeBuf = Buffer.alloc(4);
    locktimeBuf.writeUInt32LE(input["locktime"]);
    const locktimeHex = locktimeBuf.toString("hex");

    const out = await wallet.btcSignTx(input);
    const sigHex =
      "3044022006e609c8a9bedb7088d46140ab5f54a1a2023bc49b44cdf8fa147a181974b39702203e159bd869d8ccc85468856d9165cfc5df1885a8d8f1ebeaaaa5b8211f6317af";
    expect(out?.signatures).toMatchObject([sigHex]);
    expect(out?.serializedTx).toBe(
      `${BIP44_BENCHMARK_TX_OUTPUT.slice(0, 86)}${sigHex}${BIP44_BENCHMARK_TX_OUTPUT.slice(-156, -8)}${locktimeHex}`
    );
  });

  it("should automatically set the output address for a transaction", async () => {
    const input = {
      ...BIP44_BENCHMARK_TX,
      outputs: [
        {
          addressNList: core.bip32ToAddressNList("m/44'/0'/0'/0/1"),
          scriptType: core.BTCOutputScriptType.PayToAddress,
          amount: "99000",
          isChange: false,
        },
      ],
    };

    const out = await wallet.btcSignTx(input as any);

    expect(out?.signatures[0]).toMatchInlineSnapshot(
      `"3045022100b5971b81e1da04beec2ebe58b909953119b57490581de23e55721832b70c361a022038478c5a5036026fab419ccdae380143b6f14c379186dafa2a7e04735808aa1f"`
    );
    expect(out?.serializedTx).toMatchInlineSnapshot(
      `"0100000001396559eb5d84715ac64b6833a6c3ab74d1a017a3fcb5719b33e22c01c1eb0e35000000006b483045022100b5971b81e1da04beec2ebe58b909953119b57490581de23e55721832b70c361a022038478c5a5036026fab419ccdae380143b6f14c379186dafa2a7e04735808aa1f012103c6d9cc725bb7e19c026df03bf693ee1171371a8eaf25f04b7a58f6befabcd38cffffffff01b8820100000000001976a91402eea9ab5f88d829c501760bec348a5baa55cf3888ac00000000"`
    );
  });

  it("should not automatically set the output address for a transaction requesting an invalid scriptType", async () => {
    const input = {
      ...BIP44_BENCHMARK_TX,
      outputs: [
        {
          addressNList: core.bip32ToAddressNList("m/44'/0'/0'/0/1"),
          scriptType: "foobar" as any,
          amount: "99000",
          isChange: false,
        },
      ],
    };

    await expect(wallet.btcSignTx(input as any)).rejects.toThrowError("failed to add output");
  });

  it("should not sign a transaction with the wrong key", async () => {
    const input = cloneDeep(BIP44_BENCHMARK_TX);
    input.inputs[0].addressNList = core.bip32ToAddressNList("m/44'/0'/1337'/123/4");

    await expect(wallet.btcSignTx(input as any)).rejects.toThrowError("Can not sign for this input");
  });

  it("doesn't support signing messages", async () => {
    await expect(
      wallet.btcSignMessage({
        coin: "Bitcoin",
        addressNList: core.bip32ToAddressNList("m/44'/0'/0'/0/0"),
        message: "foobar",
      })
    ).rejects.toThrowError("not implemented");
  });

  it("doesn't support verifying messages", async () => {
    await expect(
      wallet.btcVerifyMessage({
        coin: "Bitcoin",
        address: "1JAd7XCBzGudGpJQSDSfpmJhiygtLQWaGL",
        message: "foo",
        signature: "bar",
      })
    ).rejects.toThrowError("not implemented");
  });
});
