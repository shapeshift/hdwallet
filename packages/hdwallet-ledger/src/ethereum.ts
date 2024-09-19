import Common from "@ethereumjs/common";
import { Transaction } from "@ethereumjs/tx";
import type { EIP712Message } from "@ledgerhq/types-live";
import * as sigUtil from "@metamask/eth-sig-util";
import * as core from "@shapeshiftoss/hdwallet-core";
import EthereumTx from "ethereumjs-tx";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// TODO: fix ts-ignore
import * as ethereumUtil from "ethereumjs-util";
import { arrayify, isBytes, isHexString, joinSignature } from "ethers/lib/utils";

import { LedgerTransport } from "./transport";
import { compressPublicKey, createXpub, handleError, networksUtil } from "./utils";

export async function ethSupportsNetwork(chain_id: number): Promise<boolean> {
  return chain_id === 1;
}

export async function ethGetAddress(transport: LedgerTransport, msg: core.ETHGetAddress): Promise<string> {
  const bip32path = core.addressNListToBIP32(msg.addressNList);
  const res = await transport.call("Eth", "getAddress", bip32path, !!msg.showDisplay);
  handleError(res, transport, "Unable to obtain ETH address from device.");

  return res.payload.address;
}

// Adapted from https://github.com/LedgerHQ/ledger-wallet-webtool
export async function ethGetPublicKeys(
  transport: LedgerTransport,
  msg: Array<core.GetPublicKey>
): Promise<Array<core.PublicKey | null>> {
  const xpubs = [];

  for (const getPublicKey of msg) {
    const { addressNList, coin } = getPublicKey;
    let { scriptType } = getPublicKey;

    if (!scriptType) scriptType = core.BTCInputScriptType.SpendAddress;

    // Only get public keys for ETH account paths
    if (!addressNList.includes(0x80000000 + 44, 0) || !addressNList.includes(0x80000000 + 60, 1)) {
      xpubs.push(null);
      continue;
    }

    const parentBip32path: string = core.addressNListToBIP32(addressNList.slice(0, -1)).substring(2); // i.e. "44'/0'"
    const bip32path: string = core.addressNListToBIP32(addressNList).substring(2); // i.e 44'/0'/0'

    const res1 = await transport.call("Eth", "getAddress", parentBip32path, /* display */ false, /* chain code */ true);
    handleError(res1, transport, "Unable to obtain public key from device.");

    const {
      payload: { publicKey: parentPublicKeyHex },
    } = res1;
    const parentPublicKey = compressPublicKey(Buffer.from(parentPublicKeyHex, "hex"));
    const parentFingerprint = new DataView(
      ethereumUtil.ripemd160(ethereumUtil.sha256(parentPublicKey), false).buffer
    ).getUint32(0);
    const res2 = await transport.call("Eth", "getAddress", bip32path, /* display */ false, /* chain code */ true);
    handleError(res2, transport, "Unable to obtain public key from device.");

    const {
      payload: { publicKey: publicKeyHex, chainCode: chainCodeHex },
    } = res2;
    const publicKey = compressPublicKey(Buffer.from(publicKeyHex, "hex"));
    const chainCode = Buffer.from(core.mustBeDefined(chainCodeHex), "hex");

    const coinDetails = networksUtil[core.mustBeDefined(core.slip44ByCoin(coin))];
    const childNum: number = addressNList[addressNList.length - 1];
    const networkMagic = coinDetails.bitcoinjs.bip32.public[scriptType];
    if (networkMagic === undefined) throw new Error(`scriptType ${scriptType} not supported`);

    xpubs.push({
      xpub: createXpub(addressNList.length, parentFingerprint, childNum, chainCode, publicKey, networkMagic),
    });
  }

  return xpubs;
}

export async function ethSignTx(transport: LedgerTransport, msg: core.ETHSignTx): Promise<core.ETHSignedTx> {
  const bip32path = core.addressNListToBIP32(msg.addressNList);
  const common = Common.custom({ chainId: msg.chainId });
  const txParams = {
    to: msg.to,
    value: msg.value,
    data: msg.data,
    chainId: msg.chainId,
    nonce: msg.nonce,
    gasLimit: msg.gasLimit,
    gasPrice: msg.gasPrice,
    v: "0x" + msg.chainId.toString(16).padStart(2, "0"),
    r: "0x00",
    s: "0x00",
  };

  const utx = new EthereumTx(txParams);

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore transport.call is drunk, there *is* a third argument to eth.signTransaction
  // see https://github.com/LedgerHQ/ledgerjs/blob/master/packages/hw-app-eth/README.md#parameters-2
  const res = await transport.call("Eth", "signTransaction", bip32path, utx.serialize().toString("hex"), null);
  handleError(res, transport, "Could not sign ETH tx with Ledger");

  const { v, r, s } = res.payload;

  const tx = Transaction.fromTxData(
    {
      ...txParams,
      v: "0x" + v,
      r: "0x" + r,
      s: "0x" + s,
    },
    { common }
  );

  return {
    v: parseInt(v, 16),
    r: "0x" + r,
    s: "0x" + s,
    serialized: "0x" + core.toHexString(tx.serialize()),
  };
}

export async function ethSupportsSecureTransfer(): Promise<boolean> {
  return false;
}

export function ethSupportsNativeShapeShift(): boolean {
  return false;
}

export function ethSupportsEIP1559(): boolean {
  return false;
}

export function ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
  const slip44 = core.slip44ByCoin(msg.coin);
  if (slip44 === undefined) return [];
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
      hardenedPath: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx],
      relPath: [0, 0],
      description: "BIP 44: Ledger (Ledger Live)",
    },
    {
      addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + 0, msg.accountIdx],
      hardenedPath: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + 0],
      relPath: [msg.accountIdx],
      description: "Non BIP 44: Ledger (legacy, Ledger Chrome App)",
    },
  ];
}

export async function ethSignMessage(
  transport: LedgerTransport,
  msg: core.ETHSignMessage
): Promise<core.ETHSignedMessage> {
  const bip32path = core.addressNListToBIP32(msg.addressNList);

  if (!isHexString(msg.message)) throw new Error("data is not an hex string");

  // Ledger's inner implementation does a Buffer.from(messageHex, "hex").length on our message
  // However, Buffer.from method with the "hex" encoding expects a valid hexadecimal string without the 0x prefix
  // so we need to strip it in case it's present
  const sanitizedMessageHex = msg.message.startsWith("0x") ? msg.message.slice(2) : msg.message;
  const res = await transport.call("Eth", "signPersonalMessage", bip32path, sanitizedMessageHex);
  handleError(res, transport, "Could not sign ETH message with Ledger");

  let { v } = res.payload;
  const { r, s } = res.payload;

  v = v - 27;
  const vStr = v.toString(16).padStart(2, "0");
  const addressRes = await transport.call("Eth", "getAddress", bip32path, false);
  handleError(addressRes, transport, "Unable to obtain ETH address from Ledger.");

  return {
    address: addressRes.payload.address,
    signature: "0x" + r + s + vStr,
  };
}

export async function ethSignTypedData(
  transport: LedgerTransport,
  msg: core.ETHSignTypedData
): Promise<core.ETHSignedTypedData> {
  const bip32path = core.addressNListToBIP32(msg.addressNList);

  if (!("EIP712Domain" in msg.typedData.types)) throw new Error("msg.typedData missing EIP712Domain");

  const res = await (async () => {
    const _res = await transport.call("Eth", "signEIP712Message", bip32path, msg.typedData as EIP712Message);
    if (_res.success === true) return _res;

    const typedData = msg.typedData as sigUtil.TypedMessage<sigUtil.MessageTypes>;
    const { types, primaryType, message } = sigUtil.TypedDataUtils.sanitizeData(typedData);

    const domainSeparatorHex = sigUtil.TypedDataUtils.eip712DomainHash(
      typedData,
      sigUtil.SignTypedDataVersion.V4
    ).toString("hex");

    const hashStructMessageHex = sigUtil.TypedDataUtils.hashStruct(
      primaryType as string,
      message,
      types,
      sigUtil.SignTypedDataVersion.V4
    ).toString("hex");

    // The old Ledger Nano S (not S+) doesn't support signEIP712Message, so we have to fallback to signEIP712HashedMessage
    // https://github.com/LedgerHQ/ledger-live/blob/1de4de022b4e3abc02fcb823ae6ef1f9a64adba2/libs/ledgerjs/packages/hw-app-eth/README.md#signeip712message
    return transport.call("Eth", "signEIP712HashedMessage", bip32path, domainSeparatorHex, hashStructMessageHex);
  })();

  handleError(res, transport, "Could not sign typed data with Ledger");

  const { r, s, v } = res.payload;

  const signature = joinSignature({
    r: `0x${r}`,
    s: `0x${s}`,
    v: typeof v === "string" ? parseInt(v, 16) : v,
  });

  const addressRes = await transport.call("Eth", "getAddress", bip32path, false);
  handleError(addressRes, transport, "Unable to obtain ETH address from Ledger.");

  return {
    address: addressRes.payload.address,
    signature,
  };
}

// Adapted from https://github.com/kvhnuke/etherwallet/blob/2a5bc0db1c65906b14d8c33ce9101788c70d3774/app/scripts/controllers/signMsgCtrl.js#L118
export async function ethVerifyMessage(msg: core.ETHVerifyMessage): Promise<boolean> {
  const sigb = Buffer.from(core.stripHexPrefixAndLower(msg.signature), "hex");
  if (sigb.length !== 65) {
    return false;
  }
  sigb[64] = sigb[64] === 0 || sigb[64] === 1 ? sigb[64] + 27 : sigb[64];
  const buffer = isBytes(msg.message) ? Buffer.from(arrayify(msg.message)) : Buffer.from(msg.message);
  const hash = ethereumUtil.hashPersonalMessage(buffer);
  const pubKey = ethereumUtil.ecrecover(hash, sigb[64], sigb.slice(0, 32), sigb.slice(32, 64));

  return core.stripHexPrefixAndLower(msg.address) === ethereumUtil.pubToAddress(pubKey).toString("hex");
}
