import {
  ETHWallet,
  ETHGetAddress,
  ETHSignTx,
  ETHSignedTx,
  ETHGetAccountPath,
  ETHAccountPath,
  ETHSignMessage,
  ETHSignedMessage,
  ETHVerifyMessage,
  Constructor,
  toHexString,
  slip44ByCoin,
  stripHexPrefix,
  addressNListToBIP32,
} from "@shapeshiftoss/hdwallet-core";

import { handleError } from "./utils";
import { TrezorTransport } from "./transport";

// @ts-ignore
import * as Ethereumjs from "ethereumjs-tx";
const { default: EthereumTx } = Ethereumjs as any;

export async function ethSupportsNetwork(chain_id: number): Promise<boolean> {
  return true;
}

export async function ethGetAddress(transport: TrezorTransport, msg: ETHGetAddress): Promise<string> {
  console.assert(
    !msg.showDisplay || !!msg.address,
    "HDWalletTrezor::ethGetAddress: expected address is required for showDisplay"
  );
  let args: any = {
    path: addressNListToBIP32(msg.addressNList),
    showOnTrezor: msg.showDisplay !== false,
  };
  if (msg.address) args.address = msg.address;
  let res = await transport.call("ethereumGetAddress", args);
  handleError(transport, res, "Could not get ETH address from Trezor");
  return res.payload.address;
}

export async function ethSignTx(wallet: ETHWallet, transport: TrezorTransport, msg: ETHSignTx): Promise<ETHSignedTx> {
  if (msg.toAddressNList !== undefined && !(await this.ethSupportsSecureTransfer()))
    throw new Error("Trezor does not support SecureTransfer");

  if (msg.exchangeType !== undefined && !this.ethSupportsNativeShapeShift())
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

  const tx = new EthereumTx(utx);
  tx.v = res.payload.v;
  tx.r = res.payload.r;
  tx.s = res.payload.s;

  return {
    v: parseInt(res.payload.v),
    r: res.payload.r,
    s: res.payload.s,
    serialized: "0x" + toHexString(tx.serialize()),
  };
}

export async function ethSignMessage(transport: TrezorTransport, msg: ETHSignMessage): Promise<ETHSignedMessage> {
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

export async function ethVerifyMessage(transport: TrezorTransport, msg: ETHVerifyMessage): Promise<boolean> {
  let res = await transport.call("ethereumVerifyMessage", {
    address: msg.address,
    message: msg.message,
    signature: stripHexPrefix(msg.signature),
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

export function ethGetAccountPaths(msg: ETHGetAccountPath): Array<ETHAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + slip44ByCoin(msg.coin), 0x80000000 + 0, 0, msg.accountIdx],
      hardenedPath: [0x80000000 + 44, 0x80000000 + slip44ByCoin(msg.coin), 0x80000000 + 0],
      relPath: [0, msg.accountIdx],
      description: "Trezor",
    },
  ];
}
