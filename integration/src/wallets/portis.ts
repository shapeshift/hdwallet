import * as core from "@shapeshiftoss/hdwallet-core";
import * as portis from "@shapeshiftoss/hdwallet-portis";

export function name(): string {
  return "Portis";
}

const mockPortis = {
  loadDevice: () => Promise.resolve(),
  importWallet: () => Promise.resolve(),
  provider: {},
};

const mockSignEthTxResponse = {
  tx: {
    r: "0x63db3dd3bf3e1fe7dde1969c0fc8850e34116d0b501c0483a0e08c0f77b8ce0a",
    s: "0x28297d012cccf389f6332415e96ee3fc0bbf8474d05f646e029cd281a031464b",
    v: 38,
  },
  raw: "0xf86b018501dcd650008256229412ec06288edd7ae2cc41a843fe089237fc7354f0872c68af0bb140008026a063db3dd3bf3e1fe7dde1969c0fc8850e34116d0b501c0483a0e08c0f77b8ce0aa028297d012cccf389f6332415e96ee3fc0bbf8474d05f646e029cd281a031464b",
};

const mockSignERC20TxResponse = {
  tx: {
    r: "0x1238fd332545415f09a01470350a5a20abc784dbf875cf58f7460560e66c597f",
    s: "0x10efa4dd6fdb381c317db8f815252c2ac0d2a883bd364901dee3dec5b7d3660a",
    v: 37,
  },
  raw: "0xf8a20114149441e5560054824ea6b0732e656e3ad64e20e94e4580b844a9059cbb0000000000000000000000001d8ce9022f6284c3a5c317f8f34620107214e54500000000000000000000000000000000000000000000000000000002540be40025a01238fd332545415f09a01470350a5a20abc784dbf875cf58f7460560e66c597fa010efa4dd6fdb381c317db8f815252c2ac0d2a883bd364901dee3dec5b7d3660a",
};

export async function createWallet(): Promise<core.HDWallet> {
  const wallet = portis.create(mockPortis as any);

  if (!wallet) throw new Error("No Portis wallet found");

  // mock web3.eth
  // this feels bad man, would be better to test against a debug verision of Portis should it ever exist
  wallet.web3 = Promise.resolve({
    eth: {
      accounts: {
        recover: async () => "0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8",
      },
      getAccounts: async () => ["0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8"],
      sign: async () =>
        "0x29f7212ecc1c76cea81174af267b67506f754ea8c73f144afa900a0d85b24b21319621aeb062903e856352f38305710190869c3ce5a1425d65ef4fa558d0fc251b",
      signTransaction: async ({ data }: any) => {
        return data.length ? mockSignERC20TxResponse : mockSignEthTxResponse;
      },
    },
  } as any);
  // end mock

  return wallet;
}

export function createInfo(): core.HDWalletInfo {
  return portis.info();
}

export function selfTest(get: () => core.HDWallet): void {
  let wallet: portis.PortisHDWallet & core.ETHWallet & core.HDWallet;

  beforeAll(() => {
    const w = get();
    if (portis.isPortis(w) && core.supportsETH(w)) {
      wallet = w;
    } else {
      throw new Error("Wallet is not Portis");
    }
  });

  it("supports Ethereum mainnet", async () => {
    if (!wallet) return;
    expect(await wallet.ethSupportsNetwork(1)).toEqual(true);
  });

  it("prepends portis: to the eth address to create the deviceId", async () => {
    if (!wallet) return;
    expect(await wallet.getDeviceID()).toEqual("portis:0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8");
  });

  it("does not support more than one account path", async () => {
    if (!wallet) return;
    const paths = core.mustBeDefined(
      await wallet.ethGetAccountPaths({
        coin: "Ethereum",
        accountIdx: 0,
      })
    );
    expect(paths.length).toEqual(1);
    const nextPath = await wallet.ethNextAccountPath(paths[0]);
    expect(nextPath).toBeUndefined();
  });
}
