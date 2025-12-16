import * as core from "@shapeshiftoss/hdwallet-core";

import { NativeHDWallet } from "../native";

const MNEMONIC = "all all all all all all all all all all all all";

describe("NativeHDWallet SUI", () => {
  let wallet: NativeHDWallet;

  beforeEach(async () => {
    wallet = new NativeHDWallet({ mnemonic: MNEMONIC, deviceId: "test" });
    await wallet.initialize();
  });

  afterEach(async () => {
    await wallet.wipe();
  });

  it("should support SUI", () => {
    expect(core.supportsSui(wallet)).toBe(true);
  });

  it("should generate SUI address", async () => {
    const address = await wallet.suiGetAddress({
      addressNList: core.suiGetAccountPaths({ accountIdx: 0 })[0].addressNList,
    });

    expect(address).toBeTruthy();
    expect(address).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("should generate different addresses for different account indices", async () => {
    const address0 = await wallet.suiGetAddress({
      addressNList: core.suiGetAccountPaths({ accountIdx: 0 })[0].addressNList,
    });

    const address1 = await wallet.suiGetAddress({
      addressNList: core.suiGetAccountPaths({ accountIdx: 1 })[0].addressNList,
    });

    expect(address0).not.toBe(address1);
  });

  it("should sign a transaction", async () => {
    // Create a mock intent message (in real usage, this would come from the SUI SDK)
    const mockIntentMessage = new Uint8Array(100);
    mockIntentMessage.fill(0xab);

    const signedTx = await wallet.suiSignTx({
      addressNList: core.suiGetAccountPaths({ accountIdx: 0 })[0].addressNList,
      intentMessageBytes: mockIntentMessage,
      transactionJson: '{"mock": "transaction"}',
    });

    expect(signedTx).toBeTruthy();
    expect(signedTx?.signature).toBeTruthy();
    expect(signedTx?.publicKey).toBeTruthy();
    expect(signedTx?.signature).toMatch(/^[0-9a-f]+$/);
    expect(signedTx?.publicKey).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should describe SUI path correctly", async () => {
    const pathDescription = wallet.describePath({
      path: core.suiGetAccountPaths({ accountIdx: 5 })[0].addressNList,
      coin: "Sui",
    });

    expect(pathDescription.isKnown).toBe(true);
    expect(pathDescription.coin).toBe("Sui");
    expect(pathDescription.accountIdx).toBe(5);
    expect(pathDescription.verbose).toBe("Sui Account #5");
  });
});
