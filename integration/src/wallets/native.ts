import * as core from "@shapeshiftoss/hdwallet-core";
import * as native from "@shapeshiftoss/hdwallet-native";

const mnemonic = "all all all all all all all all all all all all";
const deviceId = "native-test";

export function name(): string {
  return "Native";
}

export function createInfo(): core.HDWalletInfo {
  return native.info();
}

export async function createWallet(): Promise<core.HDWallet> {
  const wallet = new native.NativeHDWallet({ mnemonic, deviceId })
  await wallet.initialize()
  return wallet
}

export function selfTest(get: () => core.HDWallet): void {
  let wallet: native.NativeHDWallet;

  beforeAll(async () => {
    let w = get() as native.NativeHDWallet;

    if (native.isNative(w) && core.supportsBTC(w) && core.supportsETH(w)) {
      wallet = w;
    } else {
      fail("Wallet is not native");
    }
  });

  it("supports Ethereum mainnet", async () => {
    if (!wallet) return;
    expect(await wallet.ethSupportsNetwork()).toEqual(true);
  });

  it("does not support Native ShapeShift", async () => {
    if (!wallet) return;
    expect(wallet.ethSupportsNativeShapeShift()).toEqual(false);
    expect(wallet.btcSupportsNativeShapeShift()).toEqual(false);
  });

  it("does not support Secure Transfer", async () => {
    if (!wallet) return;
    expect(await wallet.ethSupportsSecureTransfer()).toEqual(false);
    expect(await wallet.btcSupportsSecureTransfer()).toEqual(false);
  });

  it("uses correct eth bip44 paths", () => {
    if (!wallet) return;
    [0, 1, 3, 27].forEach((account) => {
      let paths = core.mustBeDefined(
        wallet.ethGetAccountPaths({
          coin: "Ethereum",
          accountIdx: account,
        })
      );
      expect(paths).toEqual([
        {
          addressNList: core.bip32ToAddressNList(`m/44'/60'/${account}'/0/0`),
          hardenedPath: core.bip32ToAddressNList(`m/44'/60'/${account}'`),
          relPath: [0, 0],
          description: "Native",
        },
      ]);
      paths.forEach((path) => {
        expect(
          wallet.describePath({
            coin: "Ethereum",
            path: path.addressNList,
          }).isKnown
        ).toBeTruthy();
      });
    });
  });

  it("uses correct btc bip44 paths", () => {
    if (!wallet) return;

    let paths = wallet.btcGetAccountPaths({
      coin: "Litecoin",
      accountIdx: 3,
    });

    expect(paths).toEqual([
      {
        addressNList: [2147483692, 2147483650, 2147483651],
        scriptType: core.BTCInputScriptType.SpendAddress,
        coin: "Litecoin",
      },
      {
        addressNList: [2147483697, 2147483650, 2147483651],
        scriptType: core.BTCInputScriptType.SpendP2SHWitness,
        coin: "Litecoin",
      },
      {
        addressNList: [2147483732, 2147483650, 2147483651],
        scriptType: core.BTCInputScriptType.SpendWitness,
        coin: "Litecoin",
      },
    ]);
  });

  it.skip("supports ethNextAccountPath", () => {
    if (!wallet) return;

    let paths = core.mustBeDefined(
      wallet.ethGetAccountPaths({
        coin: "Ethereum",
        accountIdx: 5,
      })
    );

    expect(
      paths
        .map((path) => core.mustBeDefined(wallet.ethNextAccountPath(path)))
        .map((path) =>
          wallet.describePath({
            ...path,
            coin: "Ethereum",
            path: path.addressNList,
          })
        )
    ).toEqual([
      {
        accountIdx: 6,
        coin: "Ethereum",
        isKnown: true,
        verbose: "Ethereum Account #6",
        wholeAccount: true,
        isPrefork: false,
      },
    ]);
  });

  it("supports btcNextAccountPath", () => {
    if (!wallet) return;

    let paths = core.mustBeDefined(
      wallet.btcGetAccountPaths({
        coin: "Litecoin",
        accountIdx: 3,
      })
    );

    expect(
      paths
        .map((path) => core.mustBeDefined(wallet.btcNextAccountPath(path)))
        .map((path) =>
          wallet.describePath({
            ...path,
            path: path.addressNList,
          })
        )
    ).toEqual([
      {
        accountIdx: 4,
        coin: "Litecoin",
        isKnown: true,
        scriptType: "p2pkh",
        verbose: "Litecoin Account #4 (Legacy)",
        wholeAccount: true,
        isPrefork: false,
      },
      {
        accountIdx: 4,
        coin: "Litecoin",
        isKnown: true,
        scriptType: "p2sh-p2wpkh",
        verbose: "Litecoin Account #4",
        wholeAccount: true,
        isPrefork: false,
      },
      {
        accountIdx: 4,
        coin: "Litecoin",
        isKnown: true,
        scriptType: "p2wpkh",
        verbose: "Litecoin Account #4 (Segwit Native)",
        wholeAccount: true,
        isPrefork: false,
      },
    ]);
  });

  it("can describe a Bitcoin path", () => {
    expect(
      wallet.describePath({
        path: core.bip32ToAddressNList("m/44'/0'/0'/0/0"),
        coin: "Bitcoin",
        scriptType: core.BTCInputScriptType.SpendAddress,
      })
    ).toEqual({
      verbose: "Bitcoin Account #0, Address #0 (Legacy)",
      coin: "Bitcoin",
      isKnown: true,
      scriptType: core.BTCInputScriptType.SpendAddress,
      accountIdx: 0,
      addressIdx: 0,
      wholeAccount: false,
      isChange: false,
      isPrefork: false,
    });
  });

  it("can describe Bitcoin Change Addresses", () => {
    expect(
      wallet.describePath({
        path: core.bip32ToAddressNList("m/44'/0'/7'/1/5"),
        coin: "Bitcoin",
        scriptType: core.BTCInputScriptType.SpendAddress,
      })
    ).toEqual({
      verbose: "Bitcoin Account #7, Change Address #5 (Legacy)",
      coin: "Bitcoin",
      isKnown: true,
      scriptType: core.BTCInputScriptType.SpendAddress,
      accountIdx: 7,
      addressIdx: 5,
      wholeAccount: false,
      isChange: true,
      isPrefork: false,
    });
  });

  it.skip("can describe prefork BitcoinCash", () => {
    expect(
      wallet.describePath({
        path: core.bip32ToAddressNList("m/44'/0'/0'/0/0"),
        coin: "BitcoinCash",
        scriptType: core.BTCInputScriptType.SpendAddress,
      })
    ).toEqual({
      verbose: "BitcoinCash Account #0, Address #0 (Prefork)",
      coin: "BitcoinCash",
      isKnown: true,
      scriptType: core.BTCInputScriptType.SpendAddress,
      accountIdx: 0,
      addressIdx: 0,
      wholeAccount: false,
      isChange: false,
      isPrefork: true,
    });
  });

  it.skip("can describe prefork Segwit Native BTG", () => {
    expect(
      wallet.describePath({
        path: core.bip32ToAddressNList("m/84'/0'/0'/0/0"),
        coin: "BitcoinGold",
        scriptType: core.BTCInputScriptType.SpendWitness,
      })
    ).toEqual({
      verbose: "BitcoinGold Account #0, Address #0 (Prefork, Segwit Native)",
      coin: "BitcoinGold",
      isKnown: true,
      scriptType: core.BTCInputScriptType.SpendWitness,
      accountIdx: 0,
      addressIdx: 0,
      wholeAccount: false,
      isChange: false,
      isPrefork: true,
    });
  });

  it.skip("can describe Bitcoin Change Addresses", () => {
    expect(
      wallet.describePath({
        path: core.bip32ToAddressNList("m/44'/0'/7'/1/5"),
        coin: "Bitcoin",
        scriptType: core.BTCInputScriptType.SpendAddress,
      })
    ).toEqual({
      verbose: "Bitcoin Account #7, Change Address #5 (Legacy)",
      coin: "Bitcoin",
      isKnown: true,
      scriptType: core.BTCInputScriptType.SpendAddress,
      accountIdx: 7,
      addressIdx: 5,
      wholeAccount: false,
      isChange: true,
      isPrefork: false,
    });
  });

  it.skip("can describe prefork paths", () => {
    expect(
      wallet.describePath({
        path: core.bip32ToAddressNList("m/44'/0'/7'/1/5"),
        coin: "BitcoinCash",
        scriptType: core.BTCInputScriptType.SpendAddress,
      })
    ).toEqual({
      accountIdx: 7,
      addressIdx: 5,
      coin: "BitcoinCash",
      isChange: true,
      isKnown: true,
      isPrefork: true,
      scriptType: "p2pkh",
      verbose: "BitcoinCash Account #7, Change Address #5 (Prefork)",
      wholeAccount: false,
    });
  });

  it("can describe ETH paths", () => {
    expect(
      wallet.describePath({
        path: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
        coin: "Ethereum",
      })
    ).toEqual({
      verbose: "Ethereum Account #0",
      coin: "Ethereum",
      isKnown: true,
      accountIdx: 0,
      wholeAccount: true,
      isPrefork: false,
    });

    expect(
      wallet.describePath({
        path: core.bip32ToAddressNList("m/44'/60'/3'/0/0"),
        coin: "Ethereum",
      })
    ).toEqual({
      verbose: "Ethereum Account #3",
      coin: "Ethereum",
      isKnown: true,
      accountIdx: 3,
      wholeAccount: true,
      isPrefork: false,
    });

    expect(
      wallet.describePath({
        path: core.bip32ToAddressNList("m/44'/60'/0'/0/3"),
        coin: "Ethereum",
      })
    ).toEqual({
      verbose: "m/44'/60'/0'/0/3",
      coin: "Ethereum",
      isKnown: false,
    });
  });

  it("can describe Fio paths", () => {
    expect(
      wallet.describePath({
        path: core.bip32ToAddressNList("m/44'/235'/0'/0/0"),
        coin: "Fio",
      })
    ).toEqual({
      verbose: "Fio Account #0",
      coin: "Fio",
      isKnown: true,
      accountIdx: 0,
      wholeAccount: true,
      isPrefork: false,
    });

    expect(
      wallet.describePath({
        path: core.bip32ToAddressNList("m/44'/235'/3'/0/0"),
        coin: "Fio",
      })
    ).toEqual({
      verbose: "Fio Account #3",
      coin: "Fio",
      isKnown: true,
      accountIdx: 3,
      wholeAccount: true,
      isPrefork: false,
    });

    expect(
      wallet.describePath({
        path: core.bip32ToAddressNList("m/44'/235'/0'/0/3"),
        coin: "Fio",
      })
    ).toEqual({
      verbose: "m/44'/235'/0'/0/3",
      coin: "Fio",
      isKnown: false,
    });
  });
}
