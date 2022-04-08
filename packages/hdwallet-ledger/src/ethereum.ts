import Common from "@ethereumjs/common";
import { Transaction } from "@ethereumjs/tx";
import * as core from "@shapeshiftoss/hdwallet-core";
import EthereumTx from "ethereumjs-tx";
import * as ethereumUtil from "ethereumjs-util";

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
  const common = new Common({ chain: "mainnet", hardfork: "london" });
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

  const res = await transport.call("Eth", "signTransaction", bip32path, utx.serialize().toString("hex"));
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
  const res = await transport.call("Eth", "signPersonalMessage", bip32path, Buffer.from(msg.message).toString("hex"));
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

// Adapted from https://github.com/kvhnuke/etherwallet/blob/2a5bc0db1c65906b14d8c33ce9101788c70d3774/app/scripts/controllers/signMsgCtrl.js#L118
export async function ethVerifyMessage(msg: core.ETHVerifyMessage): Promise<boolean> {
  const sigb = Buffer.from(core.stripHexPrefixAndLower(msg.signature), "hex");
  if (sigb.length !== 65) {
    return false;
  }
  sigb[64] = sigb[64] === 0 || sigb[64] === 1 ? sigb[64] + 27 : sigb[64];
  const hash = ethereumUtil.hashPersonalMessage(Buffer.from(msg.message));
  const pubKey = ethereumUtil.ecrecover(hash, sigb[64], sigb.slice(0, 32), sigb.slice(32, 64));

  return core.stripHexPrefixAndLower(msg.address) === ethereumUtil.pubToAddress(pubKey).toString("hex");
}
