import * as core from "@shapeshiftoss/hdwallet-core";
import WalletConnect from "@walletconnect/client";

import { HDWalletWCBridge } from "./bridge";

describe("HDWalletWCBridge", () => {
  let bridge: HDWalletWCBridge;
  let connector: Partial<WalletConnect>;

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
    bridge = new HDWalletWCBridge(wallet as core.ETHWallet, connector as WalletConnect);
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

  describe("on call_request", () => {
    it("eth_sign", async () => {
      await bridge._onCallRequest(null, {
        id: 1,

        method: "eth_sign",

        payload: null,
      });

      expect(connector.approveRequest).not.toHaveBeenCalled();

      expect(connector.rejectRequest).toHaveBeenCalledWith({
        id: 1,

        error: { message: "JSON RPC method not supported" },
      });
    });

    it("eth_signTypedData", async () => {
      await bridge._onCallRequest(null, {
        id: 42,

        method: "eth_signTypedData",

        payload: null,
      });

      expect(connector.approveRequest).not.toHaveBeenCalled();

      expect(connector.rejectRequest).toHaveBeenCalledWith({
        id: 42,

        error: { message: "JSON RPC method not supported" },
      });
    });

    it("personal_sign", async () => {
      await bridge._onCallRequest(null, {
        id: 42,

        method: "personal_sign",

        params: ["message to be signed", ""],
      });

      expect(connector.approveRequest).toHaveBeenCalledWith({
        id: 42,

        result: "test signature",
      });

      expect(connector.rejectRequest).not.toHaveBeenCalled();
    });

    it("eth_sendTransaction", async () => {
      await bridge._onCallRequest(null, {
        id: 42,

        method: "eth_sendTransaction",

        params: [
          {
            chainId: 0,

            data: "0x0",

            gasLimit: "0x0",

            nonce: "0x0",

            to: "0x0",

            value: "0x0",
          },
        ],
      });

      expect(connector.approveRequest).toHaveBeenCalledWith({
        id: 42,

        result: "tx hash",
      });

      expect(connector.rejectRequest).not.toHaveBeenCalled();
    });

    it("eth_signTransaction", async () => {
      await bridge._onCallRequest(null, {
        id: 42,

        method: "eth_signTransaction",

        params: [
          {
            chainId: 0,

            data: "0x0",

            gas: "0x0",

            nonce: "0x0",

            to: "0x0",

            value: "0x0",
          },
        ],
      });

      expect(connector.approveRequest).toHaveBeenCalledWith({
        id: 42,

        result: "serialized signature",
      });

      expect(connector.rejectRequest).not.toHaveBeenCalled();
    });
  });
});
