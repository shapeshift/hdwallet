import * as core from "@shapeshiftoss/hdwallet-core";
import Common from "@ethereumjs/common";
import { Transaction } from "@ethereumjs/tx";

import { handleError } from "./utils";
import { TrezorTransport } from "./transport";

export async function ethSupportsNetwork(chain_id: number): Promise<boolean> {
  return true;
}

export async function ethGetAddress(transport: TrezorTransport, msg: core.ETHGetAddress): Promise<string> {
  console.assert(
    !msg.showDisplay || !!msg.address,
    "HDWalletTrezor::ethGetAddress: expected address is required for showDisplay"
  );
  let args: any = {
    path: core.addressNListToBIP32(msg.addressNList),
    showOnTrezor: msg.showDisplay !== false,
  };
  if (msg.address) args.address = msg.address;
  let res = await transport.call("ethereumGetAddress", args);
  handleError(transport, res, "Could not get ETH address from Trezor");
  return res.payload.address;
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

  let res = await transport.call("ethereumSignTransaction", {
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
  let res = await transport.call("ethereumSignMessage", {
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
  let res = await transport.call("ethereumVerifyMessage", {
    address: msg.address,
    message: msg.message,
    signature: core.stripHexPrefix(msg.signature),
  });
  handleError(transport, res, "Could not verify ETH message with Trezor");
  return res.payload.message === "Message verified";
}

export async function ethSupportsSecureTransfer(): Promise<boolean> {
  return false;
}

export function ethSupportsNativeShapeShift(): boolean {
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
