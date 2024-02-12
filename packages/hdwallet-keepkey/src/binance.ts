import * as Messages from "@keepkey/device-protocol/lib/messages_pb";
import * as BinanceMessages from "@keepkey/device-protocol/lib/messages-binance_pb";
import * as core from "@shapeshiftoss/hdwallet-core";
import BigNumber from "bignumber.js";
import CryptoJS from "crypto-js";

import { encodeBnbTx } from "./bnbencoding";
import { Transport } from "./transport";

export function binanceGetAccountPaths(msg: core.BinanceGetAccountPaths): Array<core.BinanceAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + core.slip44ByCoin("Binance"), 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}

export async function binanceSignTx(transport: Transport, msg: core.BinanceSignTx): Promise<core.BinanceSignedTx> {
  return transport.lockDuring(async () => {
    if (msg.testnet) throw new Error("testnet not supported");

    const partialTx = Object.assign({}, msg.tx);
    if (!partialTx.data) partialTx.data = null;
    if (!partialTx.memo) partialTx.memo = "";
    if (!partialTx.sequence) partialTx.sequence = "0";
    if (!partialTx.source) partialTx.source = "0";

    if (!partialTx.account_number) throw new Error("account_number is required");
    if (!partialTx.chain_id) throw new Error("chain_id is required");

    const tx = partialTx as core.BinanceTx;
    if (tx.data) throw new Error("tx data field not supported");

    const signTx = new BinanceMessages.BinanceSignTx();
    signTx.setAddressNList(msg.addressNList);
    signTx.setAccountNumber(tx.account_number);
    signTx.setChainId(tx.chain_id);
    signTx.setSequence(tx.sequence);
    if (tx.memo) signTx.setMemo(tx.memo);

    //verify not a batch tx
    if (msg.tx.msgs.length > 1) throw new Error("Binance batch sending not supported!");
    const message = msg.tx.msgs[0];
    //tell device not a batch tx
    signTx.setMsgCount(1);
    //tell device im about to send a tx to sign
    let resp = await transport.call(Messages.MessageType.MESSAGETYPE_BINANCESIGNTX, signTx, {
      msgTimeout: core.LONG_TIMEOUT,
      omitLock: true,
    });

    const outputAmount = new BigNumber(message.outputs[0].coins[0].amount);
    const inputAmount = new BigNumber(message.inputs[0].coins[0].amount);
    if (!outputAmount.isInteger()) throw new Error("Output amount must be an integer");
    if (!inputAmount.isInteger()) throw new Error("Input amount must be an integer");

    const coinOut = new BinanceMessages.BinanceTransferMsg.BinanceCoin();
    coinOut.setAmount(outputAmount.toString());
    coinOut.setDenom(message.outputs[0].coins[0].denom);

    const outputs = new BinanceMessages.BinanceTransferMsg.BinanceInputOutput();
    outputs.setAddress(message.outputs[0].address);
    outputs.setCoinsList([coinOut]);

    const coinIn = new BinanceMessages.BinanceTransferMsg.BinanceCoin();
    coinIn.setAmount(inputAmount.toString());
    coinIn.setDenom(message.inputs[0].coins[0].denom);

    const inputs = new BinanceMessages.BinanceTransferMsg.BinanceInputOutput();
    inputs.setAddress(message.inputs[0].address);
    inputs.setCoinsList([coinIn]);

    const send = new BinanceMessages.BinanceTransferMsg();
    send.addInputs(inputs);
    send.addOutputs(outputs);

    //sent tx to device
    resp = await transport.call(Messages.MessageType.MESSAGETYPE_BINANCETRANSFERMSG, send, {
      msgTimeout: core.LONG_TIMEOUT,
      omitLock: true,
    });

    if (resp.message_enum !== Messages.MessageType.MESSAGETYPE_BINANCESIGNEDTX) {
      throw new Error(`binance: unexpected response ${resp.message_type}`);
    }

    const signedTx = new BinanceMessages.BinanceSignedTx();
    signedTx.setSignature(resp.message.signature);
    signedTx.setPublicKey(resp.message.publicKey);

    const serialized = encodeBnbTx(
      tx,
      Buffer.from(signedTx.getPublicKey_asU8()),
      Buffer.from(signedTx.getSignature_asU8())
    ).toString("hex");

    const out: core.BinanceSignedTx = {
      ...tx,
      signatures: {
        pub_key: signedTx.getPublicKey_asB64(),
        signature: signedTx.getSignature_asB64(),
      },
      serialized,
      txid: CryptoJS.SHA256(CryptoJS.enc.Hex.parse(serialized)).toString(),
    };

    return out;
  });
}

export async function binanceGetAddress(transport: Transport, msg: core.BinanceGetAddress): Promise<string> {
  const getAddr = new BinanceMessages.BinanceGetAddress();
  getAddr.setAddressNList(msg.addressNList);
  getAddr.setShowDisplay(msg.showDisplay !== false);
  const response = await transport.call(Messages.MessageType.MESSAGETYPE_BINANCEGETADDRESS, getAddr, {
    msgTimeout: core.LONG_TIMEOUT,
  });

  const binanceAddress = response.proto as BinanceMessages.BinanceAddress;
  return core.mustBeDefined(binanceAddress.getAddress());
}
