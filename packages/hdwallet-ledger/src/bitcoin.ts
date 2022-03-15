import { CreateTransactionArg } from "@ledgerhq/hw-app-btc/lib/createTransaction";
import { Transaction } from "@ledgerhq/hw-app-btc/lib/types";
import * as core from "@shapeshiftoss/hdwallet-core";
import Base64 from "base64-js";
import * as bchAddr from "bchaddrjs";
import * as bitcoin from "bitcoinjs-lib";
import * as bitcoinMsg from "bitcoinjs-message";
import _ from "lodash";

import { LedgerTransport } from "./transport";
import { compressPublicKey, createXpub, handleError, networksUtil, translateScriptType } from "./utils";

export const supportedCoins = ["Testnet", "Bitcoin", "BitcoinCash", "Litecoin", "Dash", "DigiByte", "Dogecoin"];

const segwitCoins = ["Bitcoin", "DigiByte", "Litecoin", "BitcoinGold", "Testnet"];

export async function btcSupportsCoin(coin: core.Coin): Promise<boolean> {
  return supportedCoins.includes(coin);
}

export async function btcSupportsScriptType(coin: core.Coin, scriptType?: core.BTCInputScriptType): Promise<boolean> {
  const supported = {
    Bitcoin: [
      core.BTCInputScriptType.SpendAddress,
      core.BTCInputScriptType.SpendWitness,
      core.BTCInputScriptType.SpendP2SHWitness,
    ],
    BitcoinCash: [core.BTCInputScriptType.SpendAddress],
  } as Partial<Record<core.Coin, Array<core.BTCInputScriptType>>>;

  const scriptTypes = supported[coin];
  return !!scriptTypes && !!scriptType && scriptTypes.includes(scriptType);
}

export async function btcGetAddress(transport: LedgerTransport, msg: core.BTCGetAddress): Promise<string> {
  const bip32path = core.addressNListToBIP32(msg.addressNList);
  const opts = {
    verify: !!msg.showDisplay,
    format: translateScriptType(msg.scriptType ?? core.BTCInputScriptType.SpendAddress),
  };

  const res = await transport.call("Btc", "getWalletPublicKey", bip32path, opts);
  handleError(res, transport, "Unable to obtain BTC address from device");

  return res.payload.bitcoinAddress;
}

// Adapted from https://github.com/LedgerHQ/ledger-wallet-webtool
export async function btcGetPublicKeys(
  transport: LedgerTransport,
  msg: Array<core.GetPublicKey>
): Promise<Array<core.PublicKey | null>> {
  const xpubs: Array<core.PublicKey | null> = [];

  for (const getPublicKey of msg) {
    let { scriptType } = getPublicKey;
    const { addressNList, coin } = getPublicKey;

    if (!coin) throw new Error("coin is required");

    const parentBip32path: string = core.addressNListToBIP32(addressNList.slice(0, -1)).substring(2); // i.e. "44'/0'"
    const bip32path: string = core.addressNListToBIP32(addressNList).substring(2); // i.e 44'/0'/0'

    const opts = { verify: false };

    const res1 = await transport.call("Btc", "getWalletPublicKey", parentBip32path, opts);
    handleError(res1, transport, "Unable to obtain public key from device.");

    const {
      payload: { publicKey: parentPublicKeyHex },
    } = res1;
    const parentPublicKey = compressPublicKey(Buffer.from(parentPublicKeyHex, "hex"));
    const parentFingerprint = new DataView(
      bitcoin.crypto.ripemd160(bitcoin.crypto.sha256(parentPublicKey)).buffer
    ).getUint32(0);

    const res2 = await transport.call("Btc", "getWalletPublicKey", bip32path, opts);
    handleError(res2, transport, "Unable to obtain public key from device.");

    const {
      payload: { publicKey: publicKeyHex, chainCode: chainCodeHex },
    } = res2;
    const publicKey = compressPublicKey(Buffer.from(publicKeyHex, "hex"));
    const chainCode = Buffer.from(chainCodeHex, "hex");

    const coinDetails = networksUtil[core.mustBeDefined(core.slip44ByCoin(coin))];
    const childNum: number = addressNList[addressNList.length - 1];

    scriptType = scriptType || core.BTCInputScriptType.SpendAddress;
    const networkMagic = coinDetails.bitcoinjs.bip32.public[scriptType];
    if (!networkMagic) throw new Error("unable to get networkMagic");

    xpubs.push({
      xpub: createXpub(addressNList.length, parentFingerprint, childNum, chainCode, publicKey, networkMagic),
    });
  }

  return xpubs;
}

/*
  Sign Transaction UTXO's
      (Utilizing bitcoinjs-lib TxBuilder object)
              -Highlander

  Links: (ledger) https://www.npmjs.com/package/@ledgerhq/hw-app-btc#createpaymenttransactionnew
         (txBuilder) https://github.com/bitcoinjs/bitcoinjs-lib/issues/1011#issuecomment-368397505
  Inputs:
      See Type object --
  Outputs:
      See type object --

  Objects built internally:
    Output script
    raw Unsigned Tx

  createPaymentTransactionNew
To sign a transaction involving standard (P2PKH) inputs, call createTransaction with the following parameters

Parameters
 * arg CreateTransactionArg:
   * inputs is an array of [ transaction, output_index, optional redeem script, optional sequence ] where- transaction is the previously computed transaction object for this UTXO
     * output_index is the output in the transaction used as input for this UTXO (counting from 0)
     * redeem script is the optional redeem script to use when consuming a Segregated Witness input
     * sequence is the sequence number to use for this input (when using RBF), or non present
   * associatedKeysets is an array of BIP 32 paths pointing to the path to the private key used for each UTXO
   * changePath is an optional BIP 32 path pointing to the path to the public key used to compute the change address
   * outputScriptHex is the hexadecimal serialized outputs of the transaction to sign
   * lockTime is the optional lockTime of the transaction to sign, or default (0)
   * sigHashType is the hash type of the transaction to sign, or default (all)
   * segwit is an optional boolean indicating whether to use segwit or not
   * initialTimestamp is an optional timestamp of the function call to use for coins that necessitate timestamps only, (not the one that the tx will include)
   * additionals list of additional options:
     * "bech32" for spending native segwit outputs
     * "abc" for bch
     * "gold" for btg
     * "bipxxx" for using BIPxxx
     * "sapling" to indicate a zec transaction is supporting sapling (to be set over block 419200)
   * expiryHeight is an optional Buffer for zec overwinter / sapling Txs
   * useTrustedInputForSegwit trust inputs for segwit transactions
 */
export async function btcSignTx(
  wallet: core.BTCWallet,
  transport: LedgerTransport,
  msg: core.BTCSignTxLedger
): Promise<core.BTCSignedTx> {
  const supportsShapeShift = wallet.btcSupportsNativeShapeShift();
  const supportsSecureTransfer = await wallet.btcSupportsSecureTransfer();
  const slip44 = core.mustBeDefined(core.slip44ByCoin(msg.coin));
  const txBuilder = new bitcoin.TransactionBuilder(networksUtil[slip44].bitcoinjs as any);
  const indexes: number[] = [];
  const txs: Transaction[] = [];
  const associatedKeysets: string[] = [];
  let segwit = false;

  //bitcoinjs-lib
  msg.outputs.map((output) => {
    if (output.exchangeType && !supportsShapeShift) throw new Error("Ledger does not support Native ShapeShift");

    if (output.addressNList !== undefined) {
      if (output.addressType === core.BTCOutputAddressType.Transfer && !supportsSecureTransfer)
        throw new Error("Ledger does not support SecureTransfer");
    }

    let outputAddress: string;
    if (output.address !== undefined) {
      outputAddress = output.address;
    } else {
      throw new Error("could not determine output address");
    }
    if (msg.coin === "BitcoinCash" && bchAddr.isCashAddress(outputAddress)) {
      outputAddress = bchAddr.toLegacyAddress(outputAddress);
    }
    txBuilder.addOutput(outputAddress, Number(output.amount));
  });

  if (msg.opReturnData) {
    if (msg.opReturnData.length > 80) {
      throw new Error("OP_RETURN data must be less than 80 chars.");
    }
    const ret = bitcoin.script.compile([bitcoin.opcodes.OP_RETURN, Buffer.from(msg.opReturnData)]);
    txBuilder.addOutput(ret, 0);
  }

  const unsignedHex = txBuilder.buildIncomplete().toHex();
  const splitTxRes = await transport.call("Btc", "splitTransaction", unsignedHex);
  handleError(splitTxRes, transport, "splitTransaction failed");
  const outputScriptRes = await transport.call("Btc", "serializeTransactionOutputs", splitTxRes.payload);
  handleError(outputScriptRes, transport, "serializeTransactionOutputs failed");
  const outputScriptHex = outputScriptRes.payload.toString("hex");

  for (let i = 0; i < msg.inputs.length; i++) {
    if (
      msg.inputs[i].scriptType === core.BTCInputScriptType.SpendWitness ||
      msg.inputs[i].scriptType === core.BTCInputScriptType.SpendP2SHWitness
    )
      segwit = true;

    const keySet = core.addressNListToBIP32(msg.inputs[i].addressNList).replace(/^m\//, "");

    const vout = msg.inputs[i].vout;

    const tx = await transport.call(
      "Btc",
      "splitTransaction",
      msg.inputs[i].hex,
      networksUtil[slip44].isSegwitSupported,
      networksUtil[slip44].areTransactionTimestamped
    );
    handleError(tx, transport, "splitTransaction failed");

    indexes.push(vout);
    txs.push(tx.payload);
    associatedKeysets.push(keySet);
  }

  if (txs.length !== indexes.length) throw new Error("tx/index array length mismatch");
  const inputs = _.zip(txs, indexes, [], []) as Array<[Transaction, number, undefined, undefined]>;

  const txArgs: CreateTransactionArg = {
    inputs,
    associatedKeysets,
    outputScriptHex,
    additionals: msg.coin === "BitcoinCash" ? ["abc"] : [],
    segwit,
  };

  // "invalid data received" error from Ledger if not done this way:
  if (networksUtil[slip44].sigHash) {
    txArgs.sigHashType = networksUtil[slip44].sigHash;
  }

  const signedTx = await transport.call("Btc", "createPaymentTransactionNew", txArgs);
  handleError(signedTx, transport, "Could not sign transaction with device");

  return {
    serializedTx: signedTx.payload,
    signatures: [],
  };
}

export async function btcSupportsSecureTransfer(): Promise<boolean> {
  return false;
}

export function btcSupportsNativeShapeShift(): boolean {
  return false;
}

export async function btcSignMessage(
  wallet: core.BTCWallet,
  transport: LedgerTransport,
  msg: core.BTCSignMessage
): Promise<core.BTCSignedMessage> {
  const bip32path = core.addressNListToBIP32(msg.addressNList);

  const res = await transport.call("Btc", "signMessageNew", bip32path, Buffer.from(msg.message).toString("hex"));
  handleError(res, transport, "Could not sign message with device");
  const v = res.payload["v"] + 27 + 4;

  const signature = Buffer.from(v.toString(16) + res.payload["r"] + res.payload["s"], "hex").toString("hex");

  const coin = msg.coin;
  if (!coin) throw new Error("could not determine type of coin");
  const address = await btcGetAddress(transport, {
    addressNList: msg.addressNList,
    coin,
    showDisplay: false,
    scriptType: msg.scriptType ?? core.BTCInputScriptType.SpendAddress,
  });

  return {
    address,
    signature,
  };
}

export async function btcVerifyMessage(msg: core.BTCVerifyMessage): Promise<boolean> {
  const signature = Base64.fromByteArray(core.fromHexString(msg.signature));
  return bitcoinMsg.verify(msg.message, msg.address, signature);
}

export function btcGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
  const slip44 = core.slip44ByCoin(msg.coin);
  if (slip44 === undefined) return [];
  const bip49 = {
    coin: msg.coin,
    scriptType: core.BTCInputScriptType.SpendP2SHWitness,
    addressNList: [0x80000000 + 49, 0x80000000 + slip44, 0x80000000 + msg.accountIdx],
  };
  const bip44 = {
    coin: msg.coin,
    scriptType: core.BTCInputScriptType.SpendAddress,
    addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx],
  };
  const bip84 = {
    coin: msg.coin,
    scriptType: core.BTCInputScriptType.SpendWitness,
    addressNList: [0x80000000 + 84, 0x80000000 + slip44, 0x80000000 + msg.accountIdx],
  };

  let paths: Array<core.BTCAccountPath>;

  if (segwitCoins.includes(msg.coin)) paths = [bip49, bip44, bip84];
  else paths = [bip44];

  if (msg.scriptType !== undefined)
    paths = paths.filter((path) => {
      return path.scriptType === msg.scriptType;
    });

  return paths;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function btcIsSameAccount(msg: Array<core.BTCAccountPath>): boolean {
  // TODO: There's no way this is correct.
  return true;
}
