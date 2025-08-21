import * as core from "@shapeshiftoss/hdwallet-core";
import * as vultisig from "@shapeshiftoss/hdwallet-vultisig";
import {
  VultisigBftProvider,
  VultisigEvmProvider,
  VultisigSolanaProvider,
  VultisigUtxoProvider,
} from "@shapeshiftoss/hdwallet-vultisig/src/types";

export function name(): string {
  return "Vultisig";
}

const ethereumProvider = {
  request: jest.fn(({ method, params }: any) => {
    switch (method) {
      case "eth_accounts":
        return ["0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8"];
      case "personal_sign": {
        const [message] = params;
        if (message === "48656c6c6f20576f726c64" || message === "0x48656c6c6f20576f726c64")
          return "0x29f7212ecc1c76cea81174af267b67506f754ea8c73f144afa900a0d85b24b21319621aeb062903e856352f38305710190869c3ce5a1425d65ef4fa558d0fc251b";
        throw new Error("unknown message");
      }
      case "eth_sendTransaction": {
        const [{ to }] = params;
        return `txHash-${to}`;
      }
      default:
        throw new Error(`ethereum: Unknown method ${method}`);
    }
  }),
} as unknown as VultisigEvmProvider;

const createUtxoProvider = (coin: string) =>
  ({
    request: jest.fn(({ method }: any) => {
      switch (method) {
        case "request_accounts":
          switch (coin.toLowerCase()) {
            case "bitcoin":
              return Promise.resolve(["1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM"]);
            case "litecoin":
              return Promise.resolve(["ltc1qf6pwfkw4wd0fetq2pfrwzlfknskjg6nyvt6ngv"]);
            case "dash":
              return Promise.resolve(["XxKhGNv6ECbqVswm9KYcLPQnyWgZ86jJ6Q"]);
            default:
              return Promise.resolve(["1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM"]);
          }
        case "send_transaction": {
          const mockTx =
            "010000000182488650ef25a58fef6788bd71b8212038d7f2bbe4750bc7bcb44701e85ef6d5000000006b4830450221009a0b7be0d4ed3146ee262b42202841834698bb3ee39c24e7437df208b8b7077102202b79ab1e7736219387dffe8d615bbdba87e11477104b867ef47afed1a5ede7810121023230848585885f63803a0a8aecdd6538792d5c539215c91698e315bf0253b43dffffffff0160cc0500000000001976a914de9b2a8da088824e8fe51debea566617d851537888ac00000000";
          return Promise.resolve({
            encoded: Buffer.from(mockTx, "hex"),
          });
        }
        case "get_address":
          return Promise.resolve("1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM");
        case "get_public_key":
          return Promise.resolve("02a0434d9e47f3c86235477c7b1ae6ae5d3442d49b1943c2b752a68e2a47e247c7");
        default:
          throw new Error(`utxo: Unknown method ${method}`);
      }
    }),
  } as unknown as VultisigUtxoProvider);

const solanaProvider = {
  publicKey: undefined,
  connect: jest.fn(() => Promise.resolve({ address: "mock-solana-address" })),
  signTransaction: jest.fn(() => Promise.resolve("mock-transaction")),
  signAndSendTransaction: jest.fn(() => Promise.resolve({ signature: "mock-signature" })),
  getAccounts: jest.fn(() => Promise.resolve([{ address: "mock-solana-address" }])),
} as unknown as VultisigSolanaProvider;

const cosmosProvider = {
  getOfflineSigner: jest.fn(() => ({
    getAccounts: jest.fn(() =>
      Promise.resolve([
        {
          address: "cosmos15cenya0tr7nm3tz2wn3h3zwkht2rxrq7q7h3dj",
          pubkey: "A4ix9R88YyVHfBqurqIhcUjDBAm2gyC6y3K+SztgqFCJChQ=",
        },
      ])
    ),
    getPubkey: jest.fn(() =>
      Promise.resolve(
        new Uint8Array([
          2, 136, 177, 245, 49, 184, 120, 113, 149, 190, 179, 162, 33, 113, 72, 195, 4, 9, 54, 131, 200, 139, 114, 190,
          75, 59, 96, 168, 80, 137, 10, 33, 42,
        ])
      )
    ),
  })),
} as unknown as VultisigBftProvider;

const thorchainProvider = {
  getOfflineSigner: jest.fn(() => ({
    getAccounts: jest.fn(() =>
      Promise.resolve([
        {
          address: "thor1ls33ayg26kmltw7jjy55p32ghjna09zp74t4az",
          pubkey: "A4ix9R88YyVHfBqurqIhcUjDBAm2gyC6y3K+SztgqFCJChQ=",
        },
      ])
    ),
    getPubkey: jest.fn(() =>
      Promise.resolve(
        new Uint8Array([
          2, 136, 177, 245, 49, 184, 120, 113, 149, 190, 179, 162, 33, 113, 72, 195, 4, 9, 54, 131, 200, 139, 114, 190,
          75, 59, 96, 168, 80, 137, 10, 33, 42,
        ])
      )
    ),
  })),
} as unknown as VultisigBftProvider;

export function createInfo(): core.HDWalletInfo {
  return new vultisig.VultisigHDWalletInfo(ethereumProvider);
}

export async function createWallet(): Promise<core.HDWallet> {
  const wallet = new vultisig.VultisigHDWallet(
    ethereumProvider,
    createUtxoProvider("bitcoin"), // bitcoinProvider
    createUtxoProvider("litecoin"), // litecoinProvider
    createUtxoProvider("dogecoin"), // dogecoinProvider
    createUtxoProvider("bitcoincash"), // bitcoincashProvider
    createUtxoProvider("zcash"), // zcashProvider
    createUtxoProvider("dash"), // dashProvider
    solanaProvider,
    thorchainProvider, // thorchainProvider
    cosmosProvider // cosmosProvider
  );

  wallet.cosmosSignTx = jest.fn(async () => {
    return {
      authInfoBytes:
        "ClAKRgofL2Nvc21vcy5jcnlwdG8uc2VjcDI1NmsxLlB1YktleRIjCiEDvuOvMOU6c/OKvFovzaxCbXsE63Ko69OwGZLi0gbiStgSBAoCCAEYERISCgwKBXVhdG9tEgMxMDAQoI0G",
      body: "Co0BChwvY29zbW9zLmJhbmsudjFiZXRhMS5Nc2dTZW5kEm0KLWNvc21vczE1Y2VueWEwdHI3bm0zdHoyd24zaDN6d2todDJyeHJxN3E3aDNkahItY29zbW9zMXFqd2R5bjU2ZWNhZ2s4cmpmN2Nycnp3Y3l6Njc3NWNqODluam4zGg0KBXVhdG9tEgQxMDAwEhdTZW50IGZyb20gdGhlIGNpdGFkZWwhIA==",
      serialized:
        "CqkBCo0BChwvY29zbW9zLmJhbmsudjFiZXRhMS5Nc2dTZW5kEm0KLWNvc21vczE1Y2VueWEwdHI3bm0zdHoyd24zaDN6d2todDJyeHJxN3E3aDNkahItY29zbW9zMXFqd2R5bjU2ZWNhZ2s4cmpmN2Nycnp3Y3l6Njc3NWNqODluam4zGg0KBXVhdG9tEgQxMDAwEhdTZW50IGZyb20gdGhlIGNpdGFkZWwhIBJmClAKRgofL2Nvc21vcy5jcnlwdG8uc2VjcDI1NmsxLlB1YktleRIjCiEDvuOvMOU6c/OKvFovzaxCbXsE63Ko69OwGZLi0gbiStgSBAoCCAEYERISCgwKBXVhdG9tEgMxMDAQoI0GGkCfwTxsQmab0tn+hndmnULh0/b0h1nxvM/rt+s2XORH7nxQpPRCPw3jzk+03rZOIo+ZgW4cGf0R4odahZXZTxfG",
      signatures: ["n8E8bEJmm9LZ/oZ3Zp1C4dP29IdZ8bzP67frNlzkR+58UKT0Qj8N485PtN62TiKPmYFuHBn9EeKHWoWV2U8Xxg=="],
    };
  });

  wallet.thorchainSignTx = jest.fn(async () => {
    return {
      serialized:
        "Ck0KSwoOL3R5cGVzLk1zZ1NlbmQSOQoU/CMekQrVt/W70pEpQMVIvKfXlEESFHEof3qu6glb2/IRd4vcC0WLUomuGgsKBHJ1bmUSAzEwMBJmClAKRgofL2Nvc21vcy5jcnlwdG8uc2VjcDI1NmsxLlB1YktleRIjCiEDFRlxO4tCvcNnES0zEyzxTO35KKxXcdREukWblJcRe6MSBAoCCAEYAhISCgwKBHJ1bmUSBDMwMDAQwJoMGkAGyFdyCS09a72IfAkTkcwVPCWT65upkhCLrDNOs0S6/DvBqpV8ESts25HueBK3cojskaEM8hsMr9vy8qcftWLl",
      body: "CksKDi90eXBlcy5Nc2dTZW5kEjkKFPwjHpEK1bf1u9KRKUDFSLyn15RBEhRxKH96ruoJW9vyEXeL3AtFi1KJrhoLCgRydW5lEgMxMDA=",
      authInfoBytes:
        "ClAKRgofL2Nvc21vcy5jcnlwdG8uc2VjcDI1NmsxLlB1YktleRIjCiEDFRlxO4tCvcNnES0zEyzxTO35KKxXcdREukWblJcRe6MSBAoCCAEYAhISCgwKBHJ1bmUSBDMwMDAQwJoM",
      signatures: ["BshXcgktPWu9iHwJE5HMFTwlk+ubqZIQi6wzTrNEuvw7waqVfBErbNuR7ngSt3KI7JGhDPIbDK/b8vKnH7Vi5Q=="],
    };
  });

  await wallet.initialize();
  return wallet;
}

export function selfTest(get: () => core.HDWallet): void {
  let wallet: vultisig.VultisigHDWallet;

  beforeAll(async () => {
    const w = get() as vultisig.VultisigHDWallet;
    if (vultisig.isVultisig(w) && core.supportsBTC(w) && core.supportsETH(w)) {
      wallet = w;
    } else {
      throw new Error("Wallet is not Vultisig");
    }
  });

  it("supports Ethereum mainnet", async () => {
    if (!wallet) return;
    expect(await wallet.ethSupportsNetwork(1)).toEqual(true);
  });

  it("supports Bitcoin", async () => {
    if (!wallet) return;
    expect(core.supportsBTC(wallet)).toEqual(true);
  });

  it("does not support Secure Transfer", async () => {
    if (!wallet) return;
    expect(await wallet.ethSupportsSecureTransfer()).toEqual(false);
  });

  it("does not support Native ShapeShift", async () => {
    if (!wallet) return;
    expect(wallet.ethSupportsNativeShapeShift()).toEqual(false);
  });

  it("does not support bip44 accounts", async () => {
    if (!wallet) return;
    expect(wallet.supportsBip44Accounts()).toEqual(false);
  });

  it("supports EIP1559", async () => {
    if (!wallet) return;
    expect(await wallet.ethSupportsEIP1559()).toEqual(true);
  });

  describe("Ethereum", () => {
    it("uses correct bip44 paths", () => {
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
            description: "Vultisig",
          },
        ]);
      });
    });

    it("can describe paths", () => {
      if (!wallet) return;
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
    });
  });

  describe("Bitcoin", () => {
    it("supports correct coins", async () => {
      if (!wallet) return;
      expect(await wallet.btcSupportsCoin("Bitcoin")).toEqual(true);
      expect(await wallet.btcSupportsCoin("Litecoin")).toEqual(true);
      expect(await wallet.btcSupportsCoin("Dash")).toEqual(true);
      expect(await wallet.btcSupportsCoin("Dogecoin")).toEqual(true);
      expect(await wallet.btcSupportsCoin("BitcoinCash")).toEqual(true);
      expect(await wallet.btcSupportsCoin("Zcash")).toEqual(true);
      expect(await wallet.btcSupportsCoin("UnsupportedCoin")).toEqual(false);
    });

    it("supports correct script types", async () => {
      if (!wallet) return;
      // Bitcoin y Litecoin soportan SpendWitness (BIP84)
      expect(await wallet.btcSupportsScriptType("Bitcoin", core.BTCInputScriptType.SpendWitness)).toEqual(true);
      expect(await wallet.btcSupportsScriptType("Litecoin", core.BTCInputScriptType.SpendWitness)).toEqual(true);

      // Dash, Dogecoin, BitcoinCash, Zcash soportan SpendAddress (BIP44)
      expect(await wallet.btcSupportsScriptType("Dash", core.BTCInputScriptType.SpendAddress)).toEqual(true);
      expect(await wallet.btcSupportsScriptType("Dogecoin", core.BTCInputScriptType.SpendAddress)).toEqual(true);
      expect(await wallet.btcSupportsScriptType("BitcoinCash", core.BTCInputScriptType.SpendAddress)).toEqual(true);
      expect(await wallet.btcSupportsScriptType("Zcash", core.BTCInputScriptType.SpendAddress)).toEqual(true);

      // Script types no soportados
      expect(await wallet.btcSupportsScriptType("Bitcoin", core.BTCInputScriptType.SpendAddress)).toEqual(false);
      expect(await wallet.btcSupportsScriptType("Dash", core.BTCInputScriptType.SpendWitness)).toEqual(false);
    });

    it("uses correct paths for Bitcoin (BIP84)", () => {
      if (!wallet) return;
      const paths = wallet.btcGetAccountPaths({
        coin: "Bitcoin",
        accountIdx: 3,
      });
      expect(paths).toEqual([
        {
          addressNList: [2147483732, 2147483648, 2147483651, 0, 0], // m/84'/0'/3'/0/0
          scriptType: core.BTCInputScriptType.SpendWitness,
          coin: "Bitcoin",
        },
      ]);
    });

    it("uses correct paths for Litecoin (BIP84)", () => {
      if (!wallet) return;
      const paths = wallet.btcGetAccountPaths({
        coin: "Litecoin",
        accountIdx: 0,
      });
      expect(paths).toEqual([
        {
          addressNList: [2147483732, 2147483650, 2147483648, 0, 0], // m/84'/2'/0'/0/0
          scriptType: core.BTCInputScriptType.SpendWitness,
          coin: "Litecoin",
        },
      ]);
    });

    it("uses correct paths for Dash (BIP44)", () => {
      if (!wallet) return;
      const paths = wallet.btcGetAccountPaths({
        coin: "Dash",
        accountIdx: 1,
      });
      expect(paths).toEqual([
        {
          addressNList: [2147483692, 2147483653, 2147483649, 0, 0], // m/44'/5'/1'/0/0
          scriptType: core.BTCInputScriptType.SpendAddress,
          coin: "Dash",
        },
      ]);
    });

    it("can describe Bitcoin paths", () => {
      if (!wallet) return;
      expect(
        wallet.describePath({
          path: core.bip32ToAddressNList("m/84'/0'/0'/0/0"),
          coin: "Bitcoin",
          scriptType: core.BTCInputScriptType.SpendWitness,
        })
      ).toEqual({
        verbose: "Bitcoin Account #0, Address #0 (Segwit)",
        coin: "Bitcoin",
        isKnown: true,
        scriptType: core.BTCInputScriptType.SpendWitness,
        accountIdx: 0,
        addressIdx: 0,
        wholeAccount: false,
        isChange: false,
        isPrefork: false,
      });
    });

    it("can describe Dash paths", () => {
      if (!wallet) return;
      expect(
        wallet.describePath({
          path: core.bip32ToAddressNList("m/44'/5'/0'/0/0"),
          coin: "Dash",
          scriptType: core.BTCInputScriptType.SpendAddress,
        })
      ).toEqual({
        verbose: "Dash Account #0, Address #0",
        coin: "Dash",
        isKnown: true,
        scriptType: core.BTCInputScriptType.SpendAddress,
        accountIdx: 0,
        addressIdx: 0,
        wholeAccount: false,
        isChange: false,
        isPrefork: false,
      });
    });
  });

  describe("Solana", () => {
    it("supports Solana", () => {
      if (!wallet) return;
      expect(core.supportsSolana(wallet)).toEqual(true);
    });

    it("uses correct Solana paths", () => {
      if (!wallet) return;
      const paths = wallet.solanaGetAccountPaths({
        accountIdx: 0,
      });
      expect(paths).toEqual([
        {
          addressNList: [2147483692, 2147484149, 2147483648, 2147483648], // m/44'/501'/0'
        },
      ]);
    });
  });

  describe("Cosmos", () => {
    it("supports Cosmos", () => {
      if (!wallet) return;
      expect(core.supportsCosmos(wallet)).toEqual(true);
    });

    it("uses correct Cosmos paths", () => {
      if (!wallet) return;
      const paths = wallet.cosmosGetAccountPaths({
        accountIdx: 0,
      });
      expect(paths).toEqual([
        {
          addressNList: [2147483692, 2147483766, 2147483648, 0, 0], // m/44'/118'/0'/0/0
        },
      ]);
    });
  });

  describe("Thorchain", () => {
    it("supports Thorchain", () => {
      if (!wallet) return;
      expect(core.supportsThorchain(wallet)).toEqual(true);
    });

    it("uses correct Thorchain paths", () => {
      if (!wallet) return;
      const paths = wallet.thorchainGetAccountPaths({
        accountIdx: 0,
      });
      expect(paths).toEqual([
        {
          addressNList: [2147483692, 2147484579, 2147483648, 0, 0], // m/44'/931'/0'/0/0
        },
      ]);
    });
  });
}
