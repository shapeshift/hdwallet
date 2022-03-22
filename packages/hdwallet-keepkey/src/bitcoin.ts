import * as Exchange from "@keepkey/device-protocol/lib/exchange_pb";
import * as Messages from "@keepkey/device-protocol/lib/messages_pb";
import * as Types from "@keepkey/device-protocol/lib/types_pb";
import * as bitcoinjs from "@shapeshiftoss/bitcoinjs-lib";
import * as core from "@shapeshiftoss/hdwallet-core";
import { thaw } from "icepick";

import { Transport } from "./transport";
import { toUTF8Array, translateInputScriptType, translateOutputScriptType } from "./utils";

// FIXME: load this from the device's coin table, or from some static features
// table... instead of, you know, adding another God-forsaken coin table.
// :facepalm:
const supportedCoins = ["Bitcoin", "Testnet", "BitcoinCash", "BitcoinGold", "Litecoin", "Dash", "DigiByte", "Dogecoin"];

const segwitCoins = ["Bitcoin", "Testnet", "BitcoinGold", "Litecoin"];

function legacyAccount(coin: core.Coin, slip44: number, accountIdx: number): core.BTCAccountPath {
  return {
    coin,
    scriptType: core.BTCInputScriptType.SpendAddress,
    addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + accountIdx],
  };
}

function segwitAccount(coin: core.Coin, slip44: number, accountIdx: number): core.BTCAccountPath {
  return {
    coin,
    scriptType: core.BTCInputScriptType.SpendP2SHWitness,
    addressNList: [0x80000000 + 49, 0x80000000 + slip44, 0x80000000 + accountIdx],
  };
}

function segwitNativeAccount(coin: core.Coin, slip44: number, accountIdx: number): core.BTCAccountPath {
  return {
    coin,
    scriptType: core.BTCInputScriptType.SpendWitness,
    addressNList: [0x80000000 + 84, 0x80000000 + slip44, 0x80000000 + accountIdx],
  };
}

function packVarint(n: number): string {
  if (n < 253) return n.toString(16).padStart(2, "0");
  else if (n < 0xffff) return "FD" + n.toString(16).padStart(4, "0");
  else if (n < 0xffffffff) return "FE" + n.toString(16).padStart(8, "0");
  else return "FF" + n.toString(16).padStart(16, "0");
}

function prepareSignTx(
  coin: core.Coin,
  inputs: Array<core.BTCSignTxInputKK>,
  outputs: Array<core.BTCSignTxOutput>
): any {
  const unsignedTx = new Types.TransactionType();
  unsignedTx.setInputsCnt(inputs.length);
  unsignedTx.setOutputsCnt(outputs.length);

  inputs.forEach((input, i) => {
    const utxo = new Types.TxInputType();
    utxo.setPrevHash(core.fromHexString(input.txid));
    utxo.setPrevIndex(input.vout);
    if (input.sequence !== undefined) utxo.setSequence(input.sequence);
    utxo.setScriptType(translateInputScriptType(input.scriptType));
    utxo.setAddressNList(input.addressNList);
    utxo.setAmount(Number(input.amount));
    unsignedTx.addInputs(utxo, i);
  });

  outputs.forEach((o, k) => {
    const output: core.BTCSignTxOutput = o;
    const newOutput = new Types.TxOutputType();
    newOutput.setAmount(Number(output.amount));
    if (output.exchangeType) {
      // BTCSignTxOutputExchange
      // convert the base64 encoded signedExchangeResponse message into the correct object
      const signedHex = core.base64toHEX(output.exchangeType.signedExchangeResponse);
      const signedExchange = Exchange.SignedExchangeResponse.deserializeBinary(core.arrayify(signedHex));

      // decode the deposit amount from a little-endian Uint8Array into an unsigned uint64
      const depAmt = core.mustBeDefined(signedExchange.getResponsev2()).getDepositAmount_asU8();
      let val = 0;
      for (let jj = depAmt.length - 1; jj >= 0; jj--) {
        val += depAmt[jj] * Math.pow(2, 8 * (depAmt.length - jj - 1));
        // TODO validate is uint64
      }
      const outExchangeType = new Types.ExchangeType();
      outExchangeType.setSignedExchangeResponse(signedExchange);
      outExchangeType.setWithdrawalCoinName(output.exchangeType.withdrawalCoinName);
      outExchangeType.setWithdrawalAddressNList(output.exchangeType.withdrawalAddressNList);
      outExchangeType.setWithdrawalScriptType(
        translateInputScriptType(output.exchangeType.withdrawalScriptType || core.BTCInputScriptType.SpendAddress)
      );
      outExchangeType.setReturnAddressNList(output.exchangeType.returnAddressNList);
      outExchangeType.setReturnScriptType(
        translateInputScriptType(output.exchangeType.returnScriptType || core.BTCInputScriptType.SpendAddress)
      );
      newOutput.setAmount(val);
      newOutput.setAddress(core.mustBeDefined(signedExchange.toObject().responsev2?.depositAddress?.address));
      newOutput.setScriptType(Types.OutputScriptType.PAYTOADDRESS);
      newOutput.setAddressType(Types.OutputAddressType.EXCHANGE);
      newOutput.setExchangeType(outExchangeType);
    } else if (output.isChange || output.addressType === core.BTCOutputAddressType.Transfer) {
      // BTCSignTxOutputTranfer ||  BTCSignTxOutputChange
      newOutput.setScriptType(translateOutputScriptType(output.scriptType));
      newOutput.setAddressNList(output.addressNList);
      newOutput.setAddressType(output.isChange ? Types.OutputAddressType.CHANGE : Types.OutputAddressType.TRANSFER);
    } else if (output.opReturnData !== undefined && output.opReturnData !== null) {
      // BTCSignTxOutputMemo
      newOutput.setScriptType(Types.OutputScriptType.PAYTOOPRETURN);
      newOutput.setAddressType(Types.OutputAddressType.SPEND);
      newOutput.setOpReturnData(output.opReturnData);
    } else {
      // BTCSignTxOutputSpend
      newOutput.setScriptType(Types.OutputScriptType.PAYTOADDRESS);
      newOutput.setAddress(output.address);
      newOutput.setAddressType(Types.OutputAddressType.SPEND);
    }
    unsignedTx.addOutputs(newOutput, k);
  });

  const txmap: Record<string, unknown> = {}; // Create a map of transactions by txid needed for the KeepKey signing flow.
  txmap["unsigned"] = unsignedTx;

  const forceBip143Coins = ["BitcoinGold", "BitcoinCash", "BitcoinSV"];
  if (forceBip143Coins.includes(coin)) return txmap;

  inputs.forEach((inputTx) => {
    if (inputTx.txid in txmap) return;

    if (
      inputTx.scriptType === core.BTCInputScriptType.SpendP2SHWitness ||
      inputTx.scriptType === core.BTCInputScriptType.SpendWitness ||
      inputTx.scriptType === core.BTCInputScriptType.External
    )
      return;

    const prevTx = ((): core.BitcoinTx => {
      if (inputTx.tx) return inputTx.tx;
      if (!inputTx.hex) throw new Error("non-segwit inputs must have the associated prev tx");
      const tx = bitcoinjs.Transaction.fromHex(inputTx.hex);
      return {
        version: tx.version,
        locktime: tx.locktime,
        vin: tx.ins.map((input) => ({
          txid: Buffer.from(input.hash).reverse().toString("hex"),
          vout: input.index,
          scriptSig: {
            hex: input.script.toString("hex"),
          },
          sequence: input.sequence,
        })),
        vout: tx.outs.map((output) => ({
          value: String(output.value),
          scriptPubKey: {
            hex: output.script.toString("hex"),
          },
        })),
      };
    })();

    const tx = new Types.TransactionType();
    tx.setVersion(prevTx.version);
    tx.setLockTime(prevTx.locktime);
    tx.setInputsCnt(prevTx.vin.length);
    tx.setOutputsCnt(prevTx.vout.length);

    prevTx.vin.forEach((vin, i) => {
      const txInput = new Types.TxInputType();
      if ("coinbase" in vin) {
        txInput.setPrevHash(core.fromHexString("\0".repeat(64)));
        txInput.setPrevIndex(0xffffffff);
        txInput.setScriptSig(core.fromHexString(core.mustBeDefined(vin.coinbase)));
        txInput.setSequence(vin.sequence);
      } else {
        txInput.setPrevHash(core.fromHexString(vin.txid));
        txInput.setPrevIndex(vin.vout);
        txInput.setScriptSig(core.fromHexString(vin.scriptSig.hex));
        txInput.setSequence(vin.sequence);
      }
      tx.addInputs(txInput, i);
    });

    prevTx.vout.forEach((vout, i) => {
      const txOutput = new Types.TxOutputBinType();
      txOutput.setAmount(core.satsFromStr(vout.value));
      txOutput.setScriptPubkey(core.fromHexString(vout.scriptPubKey.hex));
      tx.addBinOutputs(txOutput, i);
    });

    if (coin === "Dash") {
      const dip2_type: number = prevTx.type || 0;
      // DIP2 Special Tx with payload
      if (prevTx.version === 3 && dip2_type !== 0) {
        if (!prevTx.extraPayload) throw new Error("Payload missing in DIP2 transaction");
        tx.setExtraData(core.fromHexString(packVarint(prevTx.extraPayload.length * 2) + prevTx.extraPayload));
      }

      // Trezor (and therefore KeepKey) firmware doesn't understand the
      // split of version and type, so let's mimic the old serialization
      // format
      tx.setVersion(prevTx.version | (dip2_type << 16));
    }

    txmap[inputTx.txid] = tx;
  });

  return txmap;
}

async function ensureCoinSupport(wallet: core.BTCWallet, coin: core.Coin): Promise<void> {
  if (!supportedCoins.includes(coin)) throw new Error(`'${coin}' not yet supported in HDWalletKeepKey`);

  if (!wallet.btcSupportsCoin(coin)) throw new Error(`'${coin} is not supported in this firmware version`);
}

function validateVoutOrdering(msg: core.BTCSignTxKK): boolean {
  // From THORChain specification:
  /* ignoreTx checks if we can already ignore a tx according to preset rules
    
     we expect array of "vout" for a BTC to have this format
     OP_RETURN is mandatory only on inbound tx
     vout:0 is our vault
     vout:1 is any any change back to themselves
     vout:2 is OP_RETURN (first 80 bytes)
     vout:3 is OP_RETURN (next 80 bytes)
    
     Rules to ignore a tx are:
     - vout:0 doesn't have coins (value)
     - vout:0 doesn't have address
     - count vouts > 4
     - count vouts with coins (value) > 2
  */

  // Check that vout:0 contains the vault address
  if (msg.outputs[0].address != msg.vaultAddress) {
    return false;
  }

  // Check that vout:1 is change address
  if (msg.outputs[1].addressType != core.BTCOutputAddressType.Change) {
    return false;
  }

  // Check and make sure vout:2 has OP_RETURN data
  if (!(msg.outputs[2] && msg.outputs[2]?.opReturnData)) {
    return false;
  }

  return true;
}

export async function btcSupportsCoin(coin: core.Coin): Promise<boolean> {
  // FIXME: inspect the CoinTable to determine which coins are actually supported by the device.
  return supportedCoins.includes(coin);
}

export async function btcSupportsScriptType(coin: core.Coin, scriptType?: core.BTCInputScriptType): Promise<boolean> {
  if (!supportedCoins.includes(coin)) return false;
  if (!segwitCoins.includes(coin) && scriptType === core.BTCInputScriptType.SpendP2SHWitness) return false;
  if (!segwitCoins.includes(coin) && scriptType === core.BTCInputScriptType.SpendWitness) return false;
  return true;
}

export async function btcGetAddress(
  wallet: core.BTCWallet,
  transport: Transport,
  msg: core.BTCGetAddress
): Promise<string> {
  await ensureCoinSupport(wallet, msg.coin);

  const addr = new Messages.GetAddress();
  addr.setAddressNList(msg.addressNList);
  addr.setCoinName(msg.coin);
  addr.setShowDisplay(msg.showDisplay || false);
  addr.setScriptType(translateInputScriptType(msg.scriptType || core.BTCInputScriptType.SpendAddress));

  const response = await transport.call(Messages.MessageType.MESSAGETYPE_GETADDRESS, addr, {
    msgTimeout: core.LONG_TIMEOUT,
  });

  if (response.message_type === core.Events.CANCEL) throw response;

  const btcAddress = response.proto as Messages.Address;
  return core.mustBeDefined(btcAddress.getAddress());
}

export async function btcSignTx(
  wallet: core.BTCWallet,
  transport: Transport,
  msgIn: core.BTCSignTxKK
): Promise<core.BTCSignedTx> {
  return transport.lockDuring(async () => {
    // Make a copy of the input parameter so as to not mutate the caller's data.
    // Unfreezing a recursively-frozen object is nontrivial, so we leverage an existing package
    const msg = thaw(msgIn);
    msg.outputs = thaw(msgIn.outputs);

    await ensureCoinSupport(wallet, msg.coin);

    if (msg.opReturnData) {
      if (msg.opReturnData.length > 80) {
        throw new Error("OP_RETURN output character count is too damn high.");
      }
      msg.outputs.push({
        addressType: core.BTCOutputAddressType.Spend,
        opReturnData: Buffer.from(msg.opReturnData).toString("base64"),
        amount: "0",
        isChange: false,
      });
    }

    // If this is a THORChain transaction, validate the vout ordering
    if (msg.vaultAddress && !validateVoutOrdering(msg)) {
      throw new Error("Improper vout ordering for BTC Thorchain transaction");
    }

    const txmap = prepareSignTx(msg.coin, msg.inputs, msg.outputs);

    // Prepare and send initial message
    const tx = new Messages.SignTx();
    tx.setInputsCount(msg.inputs.length);
    tx.setOutputsCount(msg.outputs.length);
    tx.setCoinName(msg.coin);
    if (msg.version !== undefined) tx.setVersion(msg.version);
    tx.setLockTime(msg.locktime || 0);

    let responseType: number | undefined;
    let response: any;
    const { message_enum, proto } = await transport.call(Messages.MessageType.MESSAGETYPE_SIGNTX, tx, {
      msgTimeout: core.LONG_TIMEOUT,
      omitLock: true,
    }); // 5 Minute timeout
    responseType = message_enum;
    response = proto;
    // Prepare structure for signatures
    const signatures: (string | null)[] = new Array(msg.inputs.length).fill(null);
    let serializedTx = "";

    try {
      // Begin callback loop
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (responseType !== Messages.MessageType.MESSAGETYPE_TXREQUEST) {
          throw new Error(`Unexpected message type: ${responseType}`);
        }

        const txRequest = response as Messages.TxRequest;

        // If there's some part of signed transaction, add it
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (txRequest.hasSerialized() && txRequest.getSerialized()!.hasSerializedTx()) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          serializedTx += core.toHexString(txRequest.getSerialized()!.getSerializedTx_asU8());
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (txRequest.hasSerialized() && txRequest.getSerialized()!.hasSignatureIndex()) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const sigIdx = txRequest.getSerialized()!.getSignatureIndex()!;
          if (signatures[sigIdx] !== null) {
            throw new Error(`Signature for index ${sigIdx} already filled`);
          }
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          signatures[sigIdx] = core.toHexString(txRequest.getSerialized()!.getSignature_asU8());
        }

        if (txRequest.getRequestType() === Types.RequestType.TXFINISHED) {
          // Device didn't ask for more information, finish workflow
          break;
        }

        let currentTx: Types.TransactionType;
        let currentMsg: Types.TransactionType;
        let txAck: Messages.TxAck;

        // Device asked for one more information, let's process it.
        if (!txRequest.hasDetails()) throw new Error("expected details");
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const reqDetails = txRequest.getDetails()!;

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (!reqDetails!.hasTxHash()) {
          currentTx = txmap["unsigned"];
        } else {
          currentTx = txmap[core.toHexString(reqDetails.getTxHash_asU8())];
        }

        if (txRequest.getRequestType() === Types.RequestType.TXMETA) {
          currentMsg = new Types.TransactionType();
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          if (currentTx.hasVersion()) currentMsg.setVersion(currentTx.getVersion()!);
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          if (currentTx.hasLockTime()) currentMsg.setLockTime(currentTx.getLockTime()!);
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          if (currentTx.hasInputsCnt()) currentMsg.setInputsCnt(currentTx.getInputsCnt()!);
          if (reqDetails.hasTxHash()) {
            currentMsg.setOutputsCnt(currentTx.getBinOutputsList().length);
          } else {
            currentMsg.setOutputsCnt(currentTx.getOutputsList().length);
          }
          if (currentTx.hasExtraData()) {
            currentMsg.setExtraDataLen(currentTx.getExtraData_asU8().length);
          } else {
            currentMsg.setExtraDataLen(0);
          }
          txAck = new Messages.TxAck();
          txAck.setTx(currentMsg);
          const message = await transport.call(Messages.MessageType.MESSAGETYPE_TXACK, txAck, {
            msgTimeout: core.LONG_TIMEOUT,
            omitLock: true,
          }); // 5 Minute timeout
          responseType = message.message_enum;
          response = message.proto;
          continue;
        }

        if (txRequest.getRequestType() === Types.RequestType.TXINPUT) {
          if (!reqDetails.hasRequestIndex()) throw new Error("expected request index");
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const reqIndex = reqDetails.getRequestIndex()!;
          currentMsg = new Types.TransactionType();
          currentMsg.setInputsList([currentTx.getInputsList()[reqIndex]]);
          txAck = new Messages.TxAck();
          txAck.setTx(currentMsg);
          const message = await transport.call(Messages.MessageType.MESSAGETYPE_TXACK, txAck, {
            msgTimeout: core.LONG_TIMEOUT,
            omitLock: true,
          }); // 5 Minute timeout
          responseType = message.message_enum;
          response = message.proto;
          continue;
        }

        if (txRequest.getRequestType() === Types.RequestType.TXOUTPUT) {
          if (!reqDetails.hasRequestIndex()) throw new Error("expected request index");
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const reqIndex = reqDetails.getRequestIndex()!;
          currentMsg = new Types.TransactionType();
          if (reqDetails.hasTxHash()) {
            currentMsg.setBinOutputsList([currentTx.getBinOutputsList()[reqIndex]]);
          } else {
            currentMsg.setOutputsList([currentTx.getOutputsList()[reqIndex]]);
            currentMsg.setOutputsCnt(1);
          }
          txAck = new Messages.TxAck();
          txAck.setTx(currentMsg);
          const message = await transport.call(Messages.MessageType.MESSAGETYPE_TXACK, txAck, {
            msgTimeout: core.LONG_TIMEOUT,
            omitLock: true,
          }); // 5 Minute timeout
          responseType = message.message_enum;
          response = message.proto;
          continue;
        }

        if (txRequest.getRequestType() === Types.RequestType.TXEXTRADATA) {
          if (!reqDetails.hasExtraDataOffset() || !reqDetails.hasExtraDataLen())
            throw new Error("missing extra data offset and length");
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const offset = reqDetails.getExtraDataOffset()!;
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const length = reqDetails.getExtraDataLen()!;
          currentMsg = new Types.TransactionType();
          currentMsg.setExtraData(currentTx.getExtraData_asU8().slice(offset, offset + length));
          txAck = new Messages.TxAck();
          txAck.setTx(currentMsg);
          const message = await transport.call(Messages.MessageType.MESSAGETYPE_TXACK, txAck, {
            msgTimeout: core.LONG_TIMEOUT,
            omitLock: true,
          }); // 5 Minute timeout
          responseType = message.message_enum;
          response = message.proto;
          continue;
        }
      }
    } catch (error) {
      console.error({ error });
      throw new Error("Failed to sign BTC transaction");
    }

    if (signatures.includes(null)) {
      throw new Error("Some signatures are missing!");
    }

    return {
      signatures: signatures as string[],
      serializedTx: serializedTx,
    };
  });
}

export async function btcSupportsSecureTransfer(): Promise<boolean> {
  return true;
}

export function btcSupportsNativeShapeShift(): boolean {
  return true;
}

export async function btcSignMessage(
  wallet: core.BTCWallet,
  transport: Transport,
  msg: core.BTCSignMessage
): Promise<core.BTCSignedMessage> {
  await ensureCoinSupport(wallet, msg.coin);
  const sign = new Messages.SignMessage();
  sign.setAddressNList(msg.addressNList);
  sign.setMessage(toUTF8Array(msg.message));
  sign.setCoinName(msg.coin || "Bitcoin");
  sign.setScriptType(translateInputScriptType(msg.scriptType ?? core.BTCInputScriptType.SpendAddress));
  const event = await transport.call(Messages.MessageType.MESSAGETYPE_SIGNMESSAGE, sign, {
    msgTimeout: core.LONG_TIMEOUT,
  });
  const messageSignature = event.proto as Messages.MessageSignature;
  const address = messageSignature.getAddress();
  if (!address) throw new Error("btcSignMessage failed");
  return {
    address,
    signature: core.toHexString(messageSignature.getSignature_asU8()),
  };
}

export async function btcVerifyMessage(
  wallet: core.BTCWallet,
  transport: Transport,
  msg: core.BTCVerifyMessage
): Promise<boolean> {
  await ensureCoinSupport(wallet, msg.coin);
  const verify = new Messages.VerifyMessage();
  verify.setAddress(msg.address);
  verify.setSignature(core.arrayify("0x" + msg.signature));
  verify.setMessage(toUTF8Array(msg.message));
  verify.setCoinName(msg.coin);
  let event: core.Event;
  try {
    event = await transport.call(Messages.MessageType.MESSAGETYPE_VERIFYMESSAGE, verify);
  } catch (e) {
    if (core.isIndexable(e) && e.message_enum === Messages.MessageType.MESSAGETYPE_FAILURE) {
      return false;
    }
    throw e;
  }
  const success = event.proto as Messages.Success;
  return success.getMessage() === "Message verified";
}

export function btcGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
  const slip44 = core.slip44ByCoin(msg.coin);
  if (slip44 === undefined) return [];
  const bip44 = legacyAccount(msg.coin, slip44, msg.accountIdx);
  const bip49 = segwitAccount(msg.coin, slip44, msg.accountIdx);
  const bip84 = segwitNativeAccount(msg.coin, slip44, msg.accountIdx);

  // For BTC Forks
  const btcLegacy = legacyAccount(msg.coin, core.slip44ByCoin("Bitcoin"), msg.accountIdx);
  const btcSegwit = segwitAccount(msg.coin, core.slip44ByCoin("Bitcoin"), msg.accountIdx);
  const btcSegwitNative = segwitNativeAccount(msg.coin, core.slip44ByCoin("Bitcoin"), msg.accountIdx);

  // For BCH Forks
  const bchLegacy = legacyAccount(msg.coin, core.slip44ByCoin("BitcoinCash"), msg.accountIdx);

  let paths: Array<core.BTCAccountPath> =
    (
      {
        Bitcoin: [bip44, bip49, bip84],
        Litecoin: [bip44, bip49, bip84],
        Dash: [bip44],
        DigiByte: [bip44, bip49, bip84],
        Dogecoin: [bip44],
        Testnet: [bip44, bip49, bip84],
        BitcoinCash: [bip44, btcLegacy],
        BitcoinSV: [bip44, bchLegacy, btcLegacy],
        BitcoinGold: [bip44, bip49, bip84, btcLegacy, btcSegwit, btcSegwitNative],
      } as Partial<Record<core.Coin, core.BTCAccountPath[]>>
    )[msg.coin] ?? [];

  if (msg.scriptType !== undefined)
    paths = paths.filter((path) => {
      return path.scriptType === msg.scriptType;
    });

  return paths;
}

export function btcIsSameAccount(msg: Array<core.BTCAccountPath>): boolean {
  if (msg.length < 1) return false;

  if (msg.length > 3) return false;

  const account0 = msg[0];
  if (account0.addressNList.length != 3) return false;

  // Make sure Purpose and ScriptType match
  const purpose = account0.addressNList[0];
  const purposeForScriptType = {
    [core.BTCInputScriptType.SpendAddress]: 0x80000000 + 44,
    [core.BTCInputScriptType.SpendP2SHWitness]: 0x80000000 + 49,
    [core.BTCInputScriptType.SpendWitness]: 0x80000000 + 84,
  } as Partial<Record<core.BTCInputScriptType, number>>;
  if (purposeForScriptType[account0.scriptType] !== purpose) return false;

  // Coin must be hardened
  const slip44 = account0.addressNList[1];
  if (slip44 < 0x80000000) return false;

  // Account Idx must be hardened
  const idx = account0.addressNList[2];
  if (idx < 0x80000000) return false;

  // Accounts must have the same SLIP44 and Account Idx, but may have differing
  // purpose fields (so long as they're BIP44/BIP49/BIP84)
  if (
    msg.find((path) => {
      if (path.addressNList.length != 3) return true;

      if (![0x80000000 + 44, 0x80000000 + 49, 0x80000000 + 84].includes(path.addressNList[0])) return true;

      if (purposeForScriptType[path.scriptType] !== path.addressNList[0]) return true;

      if (path.addressNList[1] != slip44) return true;

      if (path.addressNList[2] != idx) return true;
    })
  ) {
    return false;
  }

  return true;
}
