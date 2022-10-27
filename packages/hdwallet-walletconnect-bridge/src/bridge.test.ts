import * as core from "@shapeshiftoss/hdwallet-core";
import WalletConnect from "@walletconnect/client";

import { HDWalletWCBridge, HDWalletWCBridgeOptions } from "./bridge";

describe("HDWalletWCBridge", () => {
  let bridge: HDWalletWCBridge;
  let connector: Partial<WalletConnect>;
  let options: HDWalletWCBridgeOptions;

  beforeEach(async () => {
    const wallet: Partial<core.ETHWallet> = {
      _supportsETH: true,
      ethGetAddress: () => Promise.resolve("test address"),
      ethSignTx: () =>
        Promise.resolve({
          v: 0,
          r: "r",
          s: "s",
          serialized: "serialized signature",
        }),
      ethSendTx: () => Promise.resolve({ hash: "tx hash" }),
      ethSignMessage: () =>
        Promise.resolve({
          address: "test address",
          signature: "test signature",
        }),
      ethVerifyMessage: () => Promise.reject(new Error("not implemented")),
    };
    connector = {
      on: jest.fn(),
      createSession: jest.fn(),
      approveSession: jest.fn(),
      approveRequest: jest.fn(),
      rejectRequest: jest.fn(),
    };
    const onCallRequest = jest.fn();
    options = { onCallRequest };
    bridge = new HDWalletWCBridge(wallet as core.ETHWallet, connector as WalletConnect, options);
  });

  it("should subscribe to events when connecting", async () => {
    await bridge.connect();

    expect(connector.createSession).toHaveBeenCalledTimes(1);
    expect(connector.on).toHaveBeenCalledWith("session_request", expect.any(Function));
    expect(connector.on).toHaveBeenCalledWith("session_update", expect.any(Function));
    expect(connector.on).toHaveBeenCalledWith("call_request", expect.any(Function));
  });

  describe("on session_request", () => {
    it("should approve session with current chain and account", async () => {
      await bridge._onSessionRequest(null, { params: [{ chainId: 123 }] });
      expect(connector.approveSession).toHaveBeenCalledWith({
        chainId: 123,
        accounts: ["test address"],
      });
    });

    it("should default to rinkeby chain", async () => {
      await bridge._onSessionRequest(null, { params: [{ chainId: null }] });
      expect(connector.approveSession).toHaveBeenCalledWith({
        chainId: 4,
        accounts: ["test address"],
      });
    });
  });
});
