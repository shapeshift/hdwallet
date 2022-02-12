import * as core from "@shapeshiftoss/hdwallet-core";
import * as xdefi from "@shapeshiftoss/hdwallet-xdefi";
import { createMockWallet } from "./mocks/@xdefi/xdefi";

export function name(): string {
  return "XDeFi";
}

export async function createWallet(): Promise<core.HDWallet> {
  const wallet = createMockWallet();
  if (!wallet) throw new Error("No XDeFi wallet found");
  return wallet;
}

export function createInfo(): core.HDWalletInfo {
  return new xdefi.XDeFiHDWalletInfo();
}

export function selfTest(get: () => core.HDWallet): void {
  let wallet: xdefi.XDeFiHDWallet & core.ETHWallet & core.HDWallet;

  beforeAll(() => {
    let w = get();
    if (xdefi.isXDeFi(w) && core.supportsETH(w)) wallet = w;
    else fail("Wallet is not XDeFi");
  });

  it("supports Ethereum mainnet", async () => {
    if (!wallet) return;
    expect(await wallet.ethSupportsNetwork(1)).toEqual(true);
  });

  it("prepends xDeFi: to the eth address to create the deviceId", async () => {
    if (!wallet) return;
    expect(await wallet.getDeviceID()).toEqual("xDeFi:0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8");
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
