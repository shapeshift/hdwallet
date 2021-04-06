import * as core from "@shapeshiftoss/hdwallet-core";
import * as NativeHDWallet from "./native";
import * as Networks from "./networks";
import * as _ from "lodash";

const MNEMONIC = "all all all all all all all all all all all all";

const mswMock = require("mswMock")().startServer();
afterEach(() => expect(mswMock).not.toHaveBeenCalled());

const untouchable = require("untouchableMock");

function benchmarkTx(inPath, inScriptType, inTxId, inVout, inAmount, inputExtra, outAddr, outAmount) {
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
      },
    ],
    outputs: [
      {
        address: outAddr,
        addressType: core.BTCOutputAddressType.Spend,
        amount: outAmount,
        isChange: false,
      },
    ],
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

describe("NativeBTCWalletInfo", () => {
  const info = NativeHDWallet.info();

  it("should return some static metadata", async () => {
    expect(info["btcSupportsNetwork"]).not.toBeDefined();
    await expect(untouchable.call(info, "btcSupportsSecureTransfer")).resolves.toBe(false);
    expect(untouchable.call(info, "btcSupportsNativeShapeShift")).toBe(false);
  });

  it("should return some dynamic metadata", async () => {
    await expect(info.btcSupportsCoin("bitcoin")).resolves.toBe(true);
    await expect(info.btcSupportsCoin("bitcoincash")).resolves.toBe(false);

    await expect(info.btcSupportsScriptType("bitcoin", "p2pkh" as any)).resolves.toBe(true);
    await expect(info.btcSupportsScriptType("bitcoin", "p2sh" as any)).resolves.toBe(true);
    await expect(info.btcSupportsScriptType("bitcoin", "p2wpkh" as any)).resolves.toBe(true);
    await expect(info.btcSupportsScriptType("bitcoin", "p2sh-p2wpkh" as any)).resolves.toBe(true);
    await expect(info.btcSupportsScriptType("bitcoin", "cashaddr" as any)).resolves.toBe(false);
    await expect(info.btcSupportsScriptType("bitcoincash", "cashaddr" as any)).resolves.toBe(false);
    await expect(info.btcSupportsScriptType("bitcoin", "foobar" as any)).resolves.toBe(false);
    await expect(info.btcSupportsScriptType("foobar", "p2pkh" as any)).resolves.toBe(false);
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
  let wallet: NativeHDWallet.NativeHDWallet;

  beforeEach(async () => {
    wallet = NativeHDWallet.create({ deviceId: "native" });
    await wallet.loadDevice({ mnemonic: MNEMONIC });
    await expect(wallet.initialize()).resolves.toBe(true);
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
    const mock = jest.spyOn(Networks, "getNetwork").mockReturnValue(Networks.getNetwork("bitcoin", "p2pkh"));
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
    expect(out.signatures).toMatchObject([BIP44_BENCHMARK_TX_OUTPUT_SIG]);
    expect(out.serializedTx).toBe(BIP44_BENCHMARK_TX_OUTPUT);
  });

  it("should not sign a transaction without having the raw input transaction", async () => {
    const input = _.cloneDeep(BIP44_BENCHMARK_TX);
    delete input.inputs[0].hex;
    await expect(wallet.btcSignTx(input)).rejects.toThrowError();
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
    expect(out.signatures).toMatchObject([sigHex]);
    expect(out.serializedTx).toBe(
      `${BIP44_BENCHMARK_TX_OUTPUT.slice(0, 86)}${sigHex}${BIP44_BENCHMARK_TX_OUTPUT.slice(-156, -8)}${locktimeHex}`
    );
  });

  it("should sign a pre-fork BitcoinCash transaction correctly", async () => {
    const input = {
      ...BIP44_BENCHMARK_TX,
      coin: "BitcoinCash",
    };

    const out = await wallet.btcSignTx(input);
    expect(out.signatures).toMatchObject([BIP44_BENCHMARK_TX_OUTPUT_SIG]);
    expect(out.serializedTx).toBe(BIP44_BENCHMARK_TX_OUTPUT);
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

    expect(out.signatures[0]).toMatchInlineSnapshot(
      `"3045022100b5971b81e1da04beec2ebe58b909953119b57490581de23e55721832b70c361a022038478c5a5036026fab419ccdae380143b6f14c379186dafa2a7e04735808aa1f"`
    );
    expect(out.serializedTx).toMatchInlineSnapshot(
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
    const input = _.cloneDeep(BIP44_BENCHMARK_TX);
    input.inputs[0].addressNList = core.bip32ToAddressNList("m/44'/0'/1337'/123/4");

    await expect(wallet.btcSignTx(input as any)).rejects.toThrowError("Can not sign for this input");
  });

  it("doesn't support signing messages", async () => {
    await expect(
      wallet.btcSignMessage({
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
