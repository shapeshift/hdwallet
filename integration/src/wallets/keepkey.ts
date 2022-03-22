import * as core from "@shapeshiftoss/hdwallet-core";
import * as keepkey from "@shapeshiftoss/hdwallet-keepkey";
import * as keepkeyNodeWebUSB from "@shapeshiftoss/hdwallet-keepkey-nodewebusb";
import * as keepkeyTcp from "@shapeshiftoss/hdwallet-keepkey-tcp";
import AxiosHTTPAdapter from "axios/lib/adapters/http";

const TIMEOUT = 60 * 1000;

export function name(): string {
  return "KeepKey";
}

async function getBridge(keyring: core.Keyring) {
  try {
    const tcpAdapter = keepkeyTcp.TCPKeepKeyAdapter.useKeyring(keyring);
    const wallet = await tcpAdapter.pairRawDevice(
      {
        baseURL: "http://localhost:1646",
        adapter: AxiosHTTPAdapter,
      },
      true
    );
    if (wallet) console.info("Using KeepKey Bridge for tests");
    return wallet;
  } catch {
    return undefined;
  }
}

async function getDevice(keyring: core.Keyring) {
  try {
    const keepkeyAdapter = keepkeyNodeWebUSB.NodeWebUSBKeepKeyAdapter.useKeyring(keyring);
    const wallet = await keepkeyAdapter.pairDevice(undefined, true);
    if (wallet) console.info("Using attached WebUSB KeepKey for tests");
    return wallet;
  } catch {
    return undefined;
  }
}

async function getEmulator(keyring: core.Keyring) {
  try {
    const tcpAdapter = keepkeyTcp.TCPKeepKeyAdapter.useKeyring(keyring);
    const wallet = await tcpAdapter.pairRawDevice(
      {
        baseURL: "http://localhost:5000",
        adapter: AxiosHTTPAdapter,
      },
      true
    );
    if (wallet) console.info("Using KeepKey Emulator for tests");
    return wallet;
  } catch {
    return undefined;
  }
}

let autoButton = true;

export function createInfo(): core.HDWalletInfo {
  return keepkey.info();
}

export async function createWallet(): Promise<core.HDWallet> {
  const keyring = new core.Keyring();

  const wallet = (await getBridge(keyring)) || (await getDevice(keyring)) || (await getEmulator(keyring));

  if (!wallet) throw new Error("No suitable test KeepKey found");

  wallet.transport?.on(core.Events.BUTTON_REQUEST, async () => {
    if (autoButton && core.supportsDebugLink(wallet)) {
      await wallet.pressYes();
    }
  });

  return wallet;
}

export function selfTest(get: () => core.HDWallet): void {
  let wallet: keepkey.KeepKeyHDWallet & core.BTCWallet & core.ETHWallet & core.HDWallet;

  beforeAll(async () => {
    const w = get();
    if (keepkey.isKeepKey(w) && core.supportsBTC(w) && core.supportsETH(w)) {
      wallet = w;
    } else {
      throw new Error("Wallet is not a KeepKey");
    }

    await wallet.wipe();
    await wallet.loadDevice({
      mnemonic: "all all all all all all all all all all all all",
    });
  });

  it("supports Ethereum mainnet", async () => {
    if (!wallet) return;
    await expect(wallet.ethSupportsNetwork(1)).resolves.toEqual(true);
  });

  it("supports ShapeShift", async () => {
    if (!wallet) return;
    expect(wallet.ethSupportsNativeShapeShift()).toEqual(true);
  });

  it("supports Secure Transfer", async () => {
    if (!wallet) return;
    await expect(wallet.ethSupportsSecureTransfer()).resolves.toEqual(true);
  });

  it("uses the same BIP32 paths for ETH as the KeepKey Client", () => {
    if (!wallet) return;
    [0, 1, 3, 27].forEach((account) => {
      const paths = wallet.ethGetAccountPaths({
        coin: "Ethereum",
        accountIdx: account,
      });
      expect(paths).toEqual([
        {
          addressNList: core.bip32ToAddressNList(`m/44'/60'/${account}'/0/0`),
          hardenedPath: core.bip32ToAddressNList(`m/44'/60'/${account}'`),
          relPath: [0, 0],
          description: "KeepKey",
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

  it(
    "locks the transport during calls",
    async () => {
      if (!wallet) return;

      const addrs = [] as string[];
      await new Promise<void>((resolve) => {
        wallet
          .btcGetAddress({
            coin: "Bitcoin",
            addressNList: core.bip32ToAddressNList("m/44'/0'/0'/0/0"),
            showDisplay: true,
          })
          .then((address) => {
            addrs.push(address);
          });

        wallet
          .btcGetAddress({
            coin: "Bitcoin",
            addressNList: core.bip32ToAddressNList("m/44'/0'/0'/0/1"),
            showDisplay: true,
          })
          .then((address) => {
            addrs.push(address);
          });

        wallet
          .btcGetAddress({
            coin: "Bitcoin",
            addressNList: core.bip32ToAddressNList("m/44'/0'/0'/0/2"),
            showDisplay: true,
          })
          .then((address) => {
            addrs.push(address);
            resolve();
          });
      });

      expect(addrs).toEqual([
        "1JAd7XCBzGudGpJQSDSfpmJhiygtLQWaGL",
        "1GWFxtwWmNVqotUPXLcKVL2mUKpshuJYo",
        "1Eni8JFS4yA2wJkicc3yx3QzCNzopLybCM",
      ]);
    },
    TIMEOUT
  );

  // TODO: it would appear cancel is not working as expected and resulting in a hanging test.
  // revisit and look into how cancel is implemented to fix and make test pass
  // eslint-disable-next-line jest/no-disabled-tests
  test.skip(
    "cancel works",
    async () => {
      if (!wallet) return;

      autoButton = false;

      const addrPromise = wallet.btcGetAddress({
        coin: "Bitcoin",
        addressNList: core.bip32ToAddressNList("m/44'/0'/0'/0/0"),
        showDisplay: true,
      });

      await wallet.cancel();
      await expect(addrPromise).rejects.toThrow(core.ActionCancelled);

      autoButton = true;
    },
    TIMEOUT
  );

  it(
    "cancel is idempotent",
    async () => {
      if (!wallet) return;

      await wallet.cancel();
      await wallet.cancel();

      await expect(
        wallet.btcGetAddress({
          coin: "Bitcoin",
          addressNList: core.bip32ToAddressNList("m/44'/0'/0'/0/0"),
          showDisplay: true,
        })
      ).resolves.toEqual("1JAd7XCBzGudGpJQSDSfpmJhiygtLQWaGL");
    },
    TIMEOUT
  );

  it("uses correct bip44 paths", () => {
    if (!wallet) return;

    const paths = wallet.btcGetAccountPaths({
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

  it("supports ethNextAccountPath", () => {
    if (!wallet) return;

    const paths = wallet.ethGetAccountPaths({
      coin: "Ethereum",
      accountIdx: 5,
    });

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

    const paths = wallet.btcGetAccountPaths({
      coin: "Litecoin",
      accountIdx: 3,
    });

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
      wallet.info.describePath({
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

  it("can describe prefork BitcoinCash", () => {
    expect(
      wallet.info.describePath({
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

  it("can describe prefork Segwit Native BTG", () => {
    expect(
      wallet.info.describePath({
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

  it("can describe Bitcoin Change Addresses", () => {
    expect(
      wallet.info.describePath({
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

  it("can describe prefork paths", () => {
    expect(
      wallet.info.describePath({
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

  it("can describe eth paths", () => {
    expect(
      wallet.info.describePath({
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
      wallet.info.describePath({
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
      wallet.info.describePath({
        path: core.bip32ToAddressNList("m/44'/60'/0'/0/3"),
        coin: "Ethereum",
      })
    ).toEqual({
      verbose: "m/44'/60'/0'/0/3",
      coin: "Ethereum",
      isKnown: false,
    });
  });
}
