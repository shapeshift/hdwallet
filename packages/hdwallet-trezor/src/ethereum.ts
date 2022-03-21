import Common from "@ethereumjs/common";
import { Transaction } from "@ethereumjs/tx";
import * as core from "@shapeshiftoss/hdwallet-core";

import { TrezorTransport } from "./transport";
import { handleError } from "./utils";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function ethSupportsNetwork(chain_id: number): Promise<boolean> {
  return true;
}

export async function ethGetAddress(transport: TrezorTransport, msg: core.ETHGetAddress): Promise<string> {
  const res = await transport.call("ethereumGetAddress", {
    path: core.addressNListToBIP32(msg.addressNList),
    showOnTrezor: !!msg.showDisplay,
    address: msg.showDisplay
      ? await ethGetAddress(transport, {
          ...msg,
          showDisplay: false,
        })
      : undefined,
  });
  handleError(transport, res, "Could not get ETH address from Trezor");
  return res.payload.address;
}

export async function ethSupportsSecureTransfer(): Promise<boolean> {
  return false;
}

export function ethSupportsNativeShapeShift(): boolean {
  return false;
}

export async function ethSignTx(
  wallet: core.ETHWallet,
  transport: TrezorTransport,
  msg: core.ETHSignTx
): Promise<core.ETHSignedTx> {
  if (msg.toAddressNList !== undefined && !(await ethSupportsSecureTransfer()))
    throw new Error("Trezor does not support SecureTransfer");

  if (msg.exchangeType !== undefined && !ethSupportsNativeShapeShift())
    throw new Error("Trezor does not support Native ShapeShift");

  const utx = {
    to: msg.to,
    value: msg.value,
    data: msg.data,
    chainId: msg.chainId,
    nonce: msg.nonce,
    gasLimit: msg.gasLimit,
    gasPrice: msg.gasPrice,
  };

  const res = await transport.call("ethereumSignTransaction", {
    path: msg.addressNList,
    transaction: utx,
  });

  handleError(transport, res, "Could not sign ETH transaction with Trezor");

  const common = new Common({ chain: "mainnet", hardfork: "london" });
  const tx = Transaction.fromTxData({ ...utx, v: res.payload.v, r: res.payload.r, s: res.payload.s }, { common });

  return {
    v: parseInt(res.payload.v),
    r: res.payload.r,
    s: res.payload.s,
    serialized: "0x" + core.toHexString(tx.serialize()),
  };
}

export async function ethSignMessage(
  transport: TrezorTransport,
  msg: core.ETHSignMessage
): Promise<core.ETHSignedMessage> {
  const res = await transport.call("ethereumSignMessage", {
    path: msg.addressNList,
    message: msg.message,
  });
  handleError(transport, res, "Could not sign ETH message with Trezor");
  return {
    address: res.payload.address,
    signature: "0x" + res.payload.signature,
  };
}

export async function ethVerifyMessage(transport: TrezorTransport, msg: core.ETHVerifyMessage): Promise<boolean> {
  const res = await transport.call("ethereumVerifyMessage", {
    address: msg.address,
    message: msg.message,
    signature: core.stripHexPrefix(msg.signature),
  });
  handleError(transport, res, "Could not verify ETH message with Trezor");
  return res.payload.message === "Message verified";
}

export function ethSupportsEIP1559(): boolean {
  return false;
}

export function ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
  const slip44 = core.slip44ByCoin(msg.coin);
  if (slip44 === undefined) return [];
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + 0, 0, msg.accountIdx],
      hardenedPath: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + 0],
      relPath: [0, msg.accountIdx],
      description: "Trezor",
    },
  ];
}
