import * as core from "@shapeshiftoss/hdwallet-core";
import * as metamask from "@shapeshiftoss/hdwallet-metamask-multichain";
import { EIP6963ProviderInfo } from "mipd";

export function name(): string {
  return "MetaMask";
}

export function createInfo(): core.HDWalletInfo {
  return new metamask.MetaMaskMultiChainHDWalletInfo();
}

export async function createWallet(): Promise<core.HDWallet> {
  const provider = {
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
          throw new Error(`ethereum: Unkown method ${method}`);
      }
    }),
  };
  const wallet = new metamask.MetaMaskMultiChainHDWallet({
    provider,
    info: { rdns: "io.metamask" } as EIP6963ProviderInfo,
  });
  await wallet.initialize();
  return wallet;
}

export function selfTest(get: () => core.HDWallet): void {
  let wallet: metamask.MetaMaskMultiChainHDWallet;

  beforeAll(async () => {
    const w = get() as metamask.MetaMaskMultiChainHDWallet;

    if (metamask.isMetaMask(w) && core.supportsBTC(w) && core.supportsETH(w)) {
      wallet = w;
    } else {
      throw new Error("Wallet is not a MetaMask");
    }
  });

  it("supports Ethereum mainnet", async () => {
    if (!wallet) return;
    expect(await wallet.ethSupportsNetwork()).toEqual(true);
  });

  it("supports Bitcoin", async () => {
    if (!wallet) return;
    expect(core.supportsBTC(wallet)).toBe(true);
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

  it("does not support Secure Transfer", async () => {
    if (!wallet) return;
    expect(await wallet.ethSupportsSecureTransfer()).toEqual(false);
  });

  it("uses correct eth bip44 paths", () => {
    if (!wallet) return;
    // MM doesn't support multi-account *externally*, the active account is exposes should be considered account 0,
    // even if internally it may not be e.g for all intents and purposes, m/44'/60'/0'/0/1 for MetaMask should be considered m/44'/60'/0'/0/0
    const accountNumber = 0;
    const paths = wallet.ethGetAccountPaths({
      coin: "Ethereum",
      accountIdx: accountNumber,
    });
    expect(paths).toEqual([
      {
        addressNList: core.bip32ToAddressNList(`m/44'/60'/${accountNumber}'/0/0`),
        hardenedPath: core.bip32ToAddressNList(`m/44'/60'/${accountNumber}'`),
        relPath: [0, 0],
        description: "MetaMask(Shapeshift Multichain)",
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

  it("can describe ETH paths", () => {
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

  it("should return a valid ETH address", async () => {
    if (!wallet) return;
    expect(
      await wallet.ethGetAddress({
        addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
        showDisplay: false,
      })
    ).toEqual("0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8");
  });

  it("should sign a message", async () => {
    if (!wallet) return;
    const res = await wallet.ethSignMessage({
      addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
      message: "0x48656c6c6f20576f726c64", // "Hello World"
    });
    expect(res?.address).toEqual("0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8");
    expect(res?.signature).toEqual(
      "0x29f7212ecc1c76cea81174af267b67506f754ea8c73f144afa900a0d85b24b21319621aeb062903e856352f38305710190869c3ce5a1425d65ef4fa558d0fc251b"
    );
  });
}
