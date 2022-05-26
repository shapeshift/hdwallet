import * as core from "@shapeshiftoss/hdwallet-core";

import { WalletConnectHDWallet, WalletConnectWalletInfo } from "./walletconnect";

describe("WalletConnectWalletInfo", () => {
  const info = new WalletConnectWalletInfo();

  it("vendor is WalletConnect", () => {
    expect(info.getVendor()).toBe("WalletConnect");
  });
  it("hasOnDevicePinEntry returns false", () => {
    expect(info.hasOnDevicePinEntry()).toBe(false);
  });
  it("hasOnDevicePassphrase returns false", () => {
    expect(info.hasOnDevicePassphrase()).toBe(false);
  });
  it("hasOnDeviceDisplay returns false", () => {
    expect(info.hasOnDeviceDisplay()).toBe(false);
  });
  it("hasOnDeviceRecovery returns false", () => {
    expect(info.hasOnDeviceRecovery()).toBe(false);
  });
  it("hasNativeShapeShift returns false", () => {
    expect(info.hasNativeShapeShift()).toBe(false);
  });
  it("supportsOfflineSigning returns false", () => {
    expect(info.supportsOfflineSigning()).toBe(false);
  });
  it("supportsBroadcast returns true", () => {
    expect(info.supportsBroadcast()).toBe(true);
  });
  it("describePath", () => {
    const msg = { coin: "Ethereum", path: [44 + 0x80000000, 60 + 0x80000000, 0 + 0x80000000, 0, 0] };
    const expected = { coin: "Ethereum", verbose: "Ethereum Account #0", isKnown: true };
    expect(info.describePath(msg)).toMatchObject(expected);
  });
  it("ethNextAccountPath returns undefined", () => {
    const addressNList = core.bip32ToAddressNList("m/44'/60'/0'/0/0");
    const hardenedPath = core.bip32ToAddressNList(`m/44'/60'/0'`);
    const msg = { addressNList, hardenedPath, relPath: [0, 0], description: "WalletConnect" };
    expect(info.ethNextAccountPath(msg)).toBe(undefined);
  });
  it("ethSupportsNetwork returns true with no params", async () => {
    expect(await info.ethSupportsNetwork()).toBe(true);
  });

  it("ethSupportsNetwork returns true when chainId param is 1", async () => {
    expect(await info.ethSupportsNetwork(1)).toBe(true);
  });

  it("ethSupportsNetwork returns false when chainId param is not 1", async () => {
    expect(await info.ethSupportsNetwork(13)).toBe(false);
  });
  it("ethSupportsSecureTransfer returns false", async () => {
    expect(await info.ethSupportsSecureTransfer()).toBe(false);
  });
  it("ethSupportsNativeShapeShift returns false", () => {
    expect(info.ethSupportsNativeShapeShift()).toBe(false);
  });
  it("ethSupportsEIP1559 returns false", async () => {
    expect(await info.ethSupportsEIP1559()).toBe(false);
  });
  it("ethGetAccountPaths returns account:asset path", () => {
    const msg = {
      coin: "Ethereum",
      accountIdx: 0,
    };
    expect(info.ethGetAccountPaths(msg)).toMatchObject([
      {
        addressNList: core.bip32ToAddressNList(`m/44'/60'/0'/0/0`),
        hardenedPath: core.bip32ToAddressNList(`m/44'/60'/0'`),
        relPath: [0, 0],
        description: "WalletConnect",
      },
    ]);
  });
});
describe("WalletConnectWallet", () => {});
