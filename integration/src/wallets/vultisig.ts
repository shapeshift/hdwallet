import * as core from "@shapeshiftoss/hdwallet-core";
import * as vultisig from "@shapeshiftoss/hdwallet-vultisig";
import {
  VultisigEvmProvider,
  VultisigOfflineProvider,
  VultisigRequestParams,
  VultisigRequestPayload,
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
        return Promise.resolve(["0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8"]);
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
} as VultisigEvmProvider;

const createUtxoProvider = (coin: string): VultisigUtxoProvider =>
  ({
    request: jest.fn(({ method }: VultisigRequestPayload<keyof VultisigRequestParams>) => {
      switch (method) {
        case "request_accounts":
          switch (coin.toLowerCase()) {
            case "bitcoin":
              return Promise.resolve(["1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM"]);
            default:
              return Promise.resolve(["1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM"]);
          }
        default:
          throw new Error(`utxo: Unknown method ${method}`);
      }
    }),
    signPSBT: jest.fn(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      (psbt: Uint8Array, { inputsToSign }: { inputsToSign: { address: string; signingIndexes: number[] }[] }) => {
        return Promise.resolve(psbt);
      }
    ),
  } as VultisigUtxoProvider);

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
} as unknown as VultisigOfflineProvider;

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
} as unknown as VultisigOfflineProvider;

export function createInfo(): core.HDWalletInfo {
  return new vultisig.VultisigHDWalletInfo(ethereumProvider);
}

export async function createWallet(): Promise<core.HDWallet> {
  const wallet = new vultisig.VultisigHDWallet({
    evmProvider: ethereumProvider,
    bitcoinProvider: createUtxoProvider("bitcoin"), // bitcoinProvider
    solanaProvider,
    thorchainProvider, // thorchainProvider
    cosmosProvider, // cosmosProvider
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
      expect(await wallet.btcSupportsCoin("UnsupportedCoin")).toEqual(false);
    });

    it("supports correct script types", async () => {
      if (!wallet) return;
      expect(await wallet.btcSupportsScriptType("Bitcoin", core.BTCInputScriptType.SpendWitness)).toEqual(true);
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
}
