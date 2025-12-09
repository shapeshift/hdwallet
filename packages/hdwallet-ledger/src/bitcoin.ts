import ecc from "@bitcoinerlab/secp256k1";
import { CreateTransactionArg } from "@ledgerhq/hw-app-btc/lib/createTransaction";
import { Transaction } from "@ledgerhq/hw-app-btc/lib/types";
import * as bitcoin from "@shapeshiftoss/bitcoinjs-lib";
import * as core from "@shapeshiftoss/hdwallet-core";
import { BTCInputScriptType, convertXpubVersion, scriptTypeToAccountType } from "@shapeshiftoss/hdwallet-core";
import Base64 from "base64-js";
import * as bchAddr from "bchaddrjs";
import * as bitcoinMsg from "bitcoinjs-message";
import zip from "lodash/zip";

import { currencies } from "./currencies";
import { LedgerTransport } from "./transport";
import { handleError, networksUtil, translateScriptType } from "./utils";

export const supportedCoins = ["Testnet", "Bitcoin", "BitcoinCash", "Litecoin", "Dash", "DigiByte", "Dogecoin", "Zcash"];

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

  const scriptTypeish = (() => {
    if (msg.coin === "BitcoinCash") return core.BTCInputScriptType.CashAddr;
    if (msg.scriptType) return msg.scriptType;
    return core.BTCInputScriptType.SpendAddress;
  })();

  const opts = {
    verify: !!msg.showDisplay,
    format: translateScriptType(scriptTypeish),
  };

  console.log(`[${msg.coin} Ledger] btcGetAddress called:`, JSON.stringify({
    addressNList: msg.addressNList,
    bip32path,
    scriptType: msg.scriptType,
    showDisplay: !!msg.showDisplay,
    opts,
  }, null, 2));

  try {
    const res = await transport.call("Btc", "getWalletPublicKey", bip32path, opts);
    handleError(res, transport, "Unable to obtain BTC address from device");

    const address = res.payload.bitcoinAddress;
    const finalAddress = msg.coin.toLowerCase() === "bitcoincash" ? bchAddr.toCashAddress(address) : address;

    console.log(`[${msg.coin} Ledger] btcGetAddress result:`, JSON.stringify({
      address: finalAddress,
    }, null, 2));

    return finalAddress;
  } catch (error) {
    console.error(`[${msg.coin} Ledger] btcGetAddress error:`, error);
    throw error;
  }
}

// Adapted from https://github.com/LedgerHQ/ledger-wallet-webtool
export async function btcGetPublicKeys(
  transport: LedgerTransport,
  msg: Array<core.GetPublicKey>
): Promise<Array<core.PublicKey | null>> {
  const xpubs: Array<core.PublicKey | null> = [];

  for (const getPublicKey of msg) {
    const { addressNList, coin } = getPublicKey;

    if (!coin) throw new Error("coin is required");
    if (!getPublicKey.scriptType) throw new Error("scriptType is required");

    const parentBip32path: string = core.addressNListToBIP32(addressNList);

    const getWalletXpubResponse = await transport.call("Btc", "getWalletXpub", {
      path: parentBip32path,
      xpubVersion: currencies[getPublicKey.coin].xpubVersion,
    });
    handleError(getWalletXpubResponse, transport, "Unable to obtain public key from device.");

    const { payload: _xpub } = getWalletXpubResponse;

    // Ledger returns
    // - LTC pubkeys in Ltub format for all scriptTypes.
    // - BTC pubkeys in xpub format for all scriptTypes
    // - Doge pubkeys in xpub format instead of dgub
    // They *are* the correct accounts, but not in the format we want.
    // We need to convert SegWit pubkeys to Mtubs/ypubs, and SegWit native to zpubs, and Doge xpubs to dgubs.
    const xpub = convertXpubVersion(_xpub, scriptTypeToAccountType[getPublicKey.scriptType], getPublicKey.coin);

    xpubs.push({
      xpub,
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
  const supportsSecureTransfer = await wallet.btcSupportsSecureTransfer();
  const slip44 = core.mustBeDefined(core.slip44ByCoin(msg.coin));

  console.log(`[${msg.coin} Ledger] btcSignTx called:`, JSON.stringify({
    coin: msg.coin,
    inputsCount: msg.inputs.length,
    outputsCount: msg.outputs.length,
    slip44,
  }, null, 2));

  console.log(`[${msg.coin} Ledger] Input details:`, JSON.stringify(msg.inputs.map((input, idx) => ({
    index: idx,
    vout: input.vout,
    amount: input.amount,
    blockHeight: (input as any).blockHeight,
    addressNList: input.addressNList,
    hexLength: input.hex?.length,
    hexSample: input.hex?.substring(0, 100),
  })), null, 2));

  // instantiation of ecc lib required for taproot sends https://github.com/bitcoinjs/bitcoinjs-lib/issues/1889#issuecomment-1443792692
  bitcoin.initEccLib(ecc);
  const psbt = new bitcoin.Psbt({ network: networksUtil[slip44].bitcoinjs as bitcoin.Network });
  const indexes: number[] = [];
  const txs: Transaction[] = [];
  const associatedKeysets: string[] = [];
  let segwit = false;

  for (const output of msg.outputs) {
    let outputAddress: string;
    if (output.addressNList !== undefined && output.isChange) {
      const maybeOutputAddress = await wallet.btcGetAddress({
        addressNList: output.addressNList,
        scriptType: output.scriptType as unknown as BTCInputScriptType,
        coin: msg.coin,
      });
      if (!maybeOutputAddress) throw new Error("could not determine output address from addressNList");
      outputAddress = maybeOutputAddress;
    } else if (
      output.addressNList !== undefined &&
      output.addressType === core.BTCOutputAddressType.Transfer &&
      !supportsSecureTransfer
    ) {
      throw new Error("Ledger does not support SecureTransfer");
    } else if (output.address !== undefined) {
      outputAddress = output.address;
    } else {
      throw new Error("could not determine output address");
    }
    if (msg.coin === "BitcoinCash" && bchAddr.isCashAddress(outputAddress)) {
      outputAddress = bchAddr.toLegacyAddress(outputAddress);
    }
    psbt.addOutput({ address: outputAddress, value: BigInt(output.amount) });
  }

  if (msg.opReturnData) {
    if (msg.opReturnData.length > 80) {
      throw new Error("OP_RETURN data must be less than 80 chars.");
    }
    const script = bitcoin.script.compile([bitcoin.opcodes.OP_RETURN, Buffer.from(msg.opReturnData)]);

    // OP_RETURN_DATA outputs always have a value of 0
    psbt.addOutput({ script, value: BigInt(0) });
  }

  const unsignedHex = Buffer.from(psbt.data.getTransaction()).toString("hex");

  console.log(`[${msg.coin} Ledger] Splitting unsigned transaction:`, JSON.stringify({
    unsignedHexLength: unsignedHex.length,
    unsignedHexSample: unsignedHex.substring(0, 64),
  }, null, 2));

  const splitTxRes = await transport.call("Btc", "splitTransaction", unsignedHex);
  handleError(splitTxRes, transport, "splitTransaction failed");

  console.log(`[${msg.coin} Ledger] Split unsigned tx successful`);

  const outputScriptRes = await transport.call("Btc", "serializeTransactionOutputs", splitTxRes.payload);
  handleError(outputScriptRes, transport, "serializeTransactionOutputs failed");
  const outputScriptHex = outputScriptRes.payload.toString("hex");

  console.log(`[${msg.coin} Ledger] Output script hex:`, JSON.stringify({
    outputScriptHexLength: outputScriptHex.length,
    outputScriptHexSample: outputScriptHex.substring(0, 64),
  }, null, 2));

  for (let i = 0; i < msg.inputs.length; i++) {
    if (
      msg.inputs[i].scriptType === core.BTCInputScriptType.SpendWitness ||
      msg.inputs[i].scriptType === core.BTCInputScriptType.SpendP2SHWitness
    )
      segwit = true;

    const keySet = core.addressNListToBIP32(msg.inputs[i].addressNList).replace(/^m\//, "");

    const vout = msg.inputs[i].vout;

    console.log(`[${msg.coin} Ledger] Processing input ${i}:`, JSON.stringify({
      vout,
      keySet,
      scriptType: msg.inputs[i].scriptType,
      inputHexLength: msg.inputs[i].hex.length,
      inputHexSample: msg.inputs[i].hex.substring(0, 64),
      splitTransactionParams: {
        isSegwitSupported: msg.coin === "Zcash" ? true : networksUtil[slip44].isSegwitSupported,
        hasExtraData: msg.coin === "Zcash" ? true : networksUtil[slip44].areTransactionTimestamped,
        additionals: networksUtil[slip44].additionals || [],
      },
    }, null, 2));

    const tx = await transport.call(
      "Btc",
      "splitTransaction",
      msg.inputs[i].hex,
      msg.coin === "Zcash" ? true : networksUtil[slip44].isSegwitSupported,
      msg.coin === "Zcash" ? true : networksUtil[slip44].areTransactionTimestamped,
      networksUtil[slip44].additionals || []
    );
    handleError(tx, transport, "splitTransaction failed");

    console.log(`[${msg.coin} Ledger] Input ${i} split successful`);

    indexes.push(vout);
    txs.push(tx.payload);
    associatedKeysets.push(keySet);
  }

  if (txs.length !== indexes.length) throw new Error("tx/index array length mismatch");
  const sequences = msg.coin === "Zcash" ? indexes.map(() => 0) : [];

  // For Zcash, pass blockHeight of each input transaction as 5th parameter
  // This is used by Ledger to determine the correct consensus branch ID per input
  const blockHeights = msg.coin === "Zcash"
    ? msg.inputs.map((input) => (input as any).blockHeight as number | undefined)
    : [];

  console.log(`[${msg.coin} Ledger] blockHeights for inputs:`, blockHeights);

  const inputs = msg.coin === "Zcash"
    ? zip(txs, indexes, [], sequences, blockHeights) as Array<[Transaction, number, undefined, number | undefined, number | undefined]>
    : zip(txs, indexes, [], sequences) as Array<[Transaction, number, undefined, number | undefined]>;

  const txArgs: CreateTransactionArg = {
    inputs,
    associatedKeysets,
    outputScriptHex,
    additionals: (() => {
      if (msg.coin === "BitcoinCash") return ["abc"];
      if (msg.coin === "Zcash") return ["zcash", "sapling"];
      if (msg.inputs.some((input) => input.scriptType === core.BTCInputScriptType.SpendWitness)) return ["bech32"];

      return [];
    })(),
    segwit,
    useTrustedInputForSegwit: Boolean(segwit),
    blockHeight: msg.coin === "Zcash" ? 3200000 : undefined,
    expiryHeight: msg.coin === "Zcash" ? Buffer.alloc(4) : undefined,
  };

  // "invalid data received" error from Ledger if not done this way:
  if (networksUtil[slip44].sigHash) {
    txArgs.sigHashType = networksUtil[slip44].sigHash;
  }

  console.log(`[${msg.coin} Ledger] createPaymentTransaction args:`, JSON.stringify({
    inputsCount: txArgs.inputs.length,
    associatedKeysetsCount: txArgs.associatedKeysets.length,
    additionals: txArgs.additionals,
    segwit: txArgs.segwit,
    blockHeight: (txArgs as any).blockHeight,
    expiryHeightHex: txArgs.expiryHeight?.toString("hex"),
    expiryHeightDecimal: txArgs.expiryHeight?.readUInt32LE(0),
    sigHashType: txArgs.sigHashType,
  }, null, 2));

  try {
    const signedTx = await transport.call("Btc", "createPaymentTransaction", txArgs);
    handleError(signedTx, transport, "Could not sign transaction with device");

    console.log(`[${msg.coin} Ledger] Transaction signed successfully:`, JSON.stringify({
      serializedTxLength: signedTx.payload.length,
      serializedTxSample: signedTx.payload.substring(0, 64),
    }, null, 2));

    console.log(`[${msg.coin} Ledger] FULL TRANSACTION HEX:`, signedTx.payload);

    return {
      serializedTx: signedTx.payload,
      signatures: [],
    };
  } catch (error) {
    console.error(`[${msg.coin} Ledger] btcSignTx error:`, error);
    throw error;
  }
}

export async function btcSupportsSecureTransfer(): Promise<boolean> {
  return false;
}

export function btcSupportsNativeShapeShift(): boolean {
  return false;
}

export async function btcSignMessage(
  _wallet: core.BTCWallet,
  transport: LedgerTransport,
  msg: core.BTCSignMessage
): Promise<core.BTCSignedMessage> {
  const bip32path = core.addressNListToBIP32(msg.addressNList);

  const res = await transport.call("Btc", "signMessage", bip32path, Buffer.from(msg.message).toString("hex"));
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
