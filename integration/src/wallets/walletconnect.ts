import * as core from "@keepkey/hdwallet-core";
import * as walletconnect from "@keepkey/hdwallet-walletconnect";

export function name(): string {
  return "WalletConnect";
}

export function createInfo(): core.HDWalletInfo {
  return new walletconnect.WalletConnectWalletInfo();
}

export async function createWallet(): Promise<core.HDWallet> {
  const accounts = [
    "0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8",
    "0x8CB8864f185f14e8d7da0000e4a55a09e4156ff6",
    "0x4e8d2E3d5FDe8CB80A917e258548268734973f23",
  ];
  const provider = {
    request: jest.fn(({ method, params }: any) => {
      switch (method) {
        case "eth_accounts":
          return accounts;
        case "personal_sign": {
          const [message] = params;

          if (message === "48656c6c6f20576f726c64")
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
    bridge: "https://bridge.walletconnect.org",
    qrcode: true,
    qrcodeModal: {},
    qrcodeModalOptions: undefined,
    rpc: null,
    infuraId: "",
    http: null,
    wc: {
      sendTransaction: jest.fn((msg) => {
        const { to } = msg;
        return { hash: `txHash-${to}` };
      }),
      signMessage: jest.fn().mockReturnValue({
        address: "0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8",
        signature:
          "0x29f7212ecc1c76cea81174af267b67506f754ea8c73f144afa900a0d85b24b21319621aeb062903e856352f38305710190869c3ce5a1425d65ef4fa558d0fc251b",
      }),
    }, // connector
    isConnecting: false,
    connected: false,
    connectCallbacks: [],
    rpcUrl: "",
    isWalletConnect: true,
    connector: {
      chainId: 1,
      accounts,
      connected: true,
      on: jest.fn(),
    },
    walletMeta: {
      // wc.peerMeta
    },
    enable: async () => Promise.resolve(accounts),
    send: jest.fn(),
    onConnect: jest.fn(),
    triggerConnect: jest.fn(),
    disconnect: jest.fn(), // alias for close
    close: jest.fn(),
    handleRequest: jest.fn(),
    handleOtherRequests: jest.fn(),
    handleReadRequests: jest.fn(),
    formatResponse: jest.fn(),
    getWalletConnector: jest.fn(),
    subscribeWalletConnector: jest.fn(),
    onDisconnect: jest.fn(),
    updateState: jest.fn(),
    updateRpcUrl: jest.fn(),
    updateHttpConnection: jest.fn(),
    sendAsyncPromise: jest.fn(),
  };
  const wallet = new walletconnect.WalletConnectHDWallet(provider as any);
  await wallet.initialize();
  return wallet;
}

export function selfTest(get: () => core.HDWallet): void {
  let wallet: walletconnect.WalletConnectHDWallet;

  beforeAll(async () => {
    const w = get() as walletconnect.WalletConnectHDWallet;

    if (walletconnect.isWalletConnect(w) && !core.supportsBTC(w) && core.supportsETH(w)) {
      wallet = w;
    } else {
      throw new Error("Wallet is not a WalletConnect");
    }
  });

  it("supports Ethereum mainnet", async () => {
    if (!wallet) return;
    expect(await wallet.ethSupportsNetwork()).toEqual(true);
  });

  it("does not support BTC", async () => {
    if (!wallet) return;
    expect(core.supportsBTC(wallet)).toBe(false);
  });

  it("does not support Native ShapeShift", async () => {
    if (!wallet) return;
    expect(wallet.ethSupportsNativeShapeShift()).toEqual(false);
  });

  it("does not support EIP1559", async () => {
    if (!wallet) return;
    expect(await wallet.ethSupportsEIP1559()).toEqual(false);
  });

  it("does not support Secure Transfer", async () => {
    if (!wallet) return;
    expect(await wallet.ethSupportsSecureTransfer()).toEqual(false);
  });

  it("uses correct eth bip44 paths", () => {
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
          description: "WalletConnect",
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
      isPrefork: false,
      accountIdx: 0,
      wholeAccount: true,
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
      isPrefork: false,
      accountIdx: 3,
      wholeAccount: true,
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
    expect(await wallet.ethGetAddress()).toEqual("0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8");
  });

  it("does not support bip44 accounts", async () => {
    if (!wallet) return;
    expect(wallet.supportsBip44Accounts()).toEqual(false);
  });

  it("should sign a message", async () => {
    if (!wallet) return;
    const res = await wallet.ethSignMessage({
      addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
      message: "Hello World",
    });
    expect(res?.address).toEqual("0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8");
    expect(res?.signature).toEqual(
      "0x29f7212ecc1c76cea81174af267b67506f754ea8c73f144afa900a0d85b24b21319621aeb062903e856352f38305710190869c3ce5a1425d65ef4fa558d0fc251b"
    );
  });
}
