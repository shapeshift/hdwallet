import * as Core from "@shapeshiftoss/hdwallet-core";

import { KeepKeyTransport } from "./transport";

import {
  BinanceGetAddress,
  BinanceAddress,
  BinanceSignTx,
  BinanceSignedTx,
  BinanceTransferMsg,
} from "@keepkey/device-protocol/lib/messages-binance_pb";
import { MessageType } from "@keepkey/device-protocol/lib/messages_pb";

export function binanceGetAccountPaths(msg: Core.BinanceGetAccountPaths): Array<Core.BinanceAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + Core.slip44ByCoin("Binance"), 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}

export async function binanceSignTx(
  transport: KeepKeyTransport,
  msg: Core.BinanceSignTx
): Promise<Core.BinanceSignedTx> {
  return transport.lockDuring(async () => {
    const signTx = new BinanceSignTx();
    signTx.setAddressNList(msg.addressNList);
    signTx.setAccountNumber(msg.account_number);
    signTx.setChainId(msg.chain_id);
    signTx.setSequence(String(msg.sequence));
    if (msg.tx.memo !== undefined) signTx.setMemo(msg.tx.memo);

    //verify not a batch tx
    if (msg.tx.msgs.length > 1) throw new Error("Binance batch sending not supported!");
    let message = msg.tx.msgs[0];
    //tell device not a batch tx
    signTx.setMsgCount(1);
    //tell device im about to send a tx to sign
    let resp = await transport.call(
      MessageType.MESSAGETYPE_BINANCESIGNTX,
      signTx,
      Core.LONG_TIMEOUT,
      /*omitLock=*/ true
    );
    if (resp.message_type === Core.Events.FAILURE) throw resp;

    let coinOut = new BinanceTransferMsg.BinanceCoin();
    coinOut.setAmount(message.outputs[0].coins[0].amount);
    coinOut.setDenom(message.outputs[0].coins[0].denom);

    let outputs = new BinanceTransferMsg.BinanceInputOutput();
    outputs.setAddress(message.outputs[0].address);
    outputs.setCoinsList([coinOut]);

    let coinIn = new BinanceTransferMsg.BinanceCoin();
    coinIn.setAmount(message.inputs[0].coins[0].amount);
    coinIn.setDenom(message.inputs[0].coins[0].denom);

    let inputs = new BinanceTransferMsg.BinanceInputOutput();
    inputs.setAddress(message.inputs[0].address);
    inputs.setCoinsList([coinIn]);

    const send = new BinanceTransferMsg();
    send.addInputs(inputs);
    send.addOutputs(outputs);

    //sent tx to device
    resp = await transport.call(
      MessageType.MESSAGETYPE_BINANCETRANSFERMSG,
      send,
      Core.LONG_TIMEOUT,
      /*omitLock=*/ true
    );

    if (resp.message_type === Core.Events.FAILURE) throw resp;
    if (resp.message_enum !== MessageType.MESSAGETYPE_BINANCESIGNEDTX) {
      throw new Error(`binance: unexpected response ${resp.message_type}`);
    }

    let signedTx = new BinanceSignedTx();
    signedTx.setSignature(resp.message.signature);
    signedTx.setPublicKey(resp.message.publicKey);

    let output: Core.BinanceSignedTx = {
      account_number: msg.account_number,
      chain_id: msg.chain_id,
      data: null,
      memo: msg.tx.memo,
      msgs: msg.tx.msgs,
      signatures: {
        pub_key: signedTx.getPublicKey_asB64(),
        signature: signedTx.getSignature_asB64(),
      },
    };

    return output;
  });
}

export async function binanceGetAddress(transport: KeepKeyTransport, msg: Core.BinanceGetAddress): Promise<string> {
  const getAddr = new BinanceGetAddress();
  getAddr.setAddressNList(msg.addressNList);
  getAddr.setShowDisplay(msg.showDisplay !== false);
  const response = await transport.call(MessageType.MESSAGETYPE_BINANCEGETADDRESS, getAddr, Core.LONG_TIMEOUT);

  if (response.message_type === Core.Events.FAILURE) throw response;

  const binanceAddress = response.proto as BinanceAddress;
  return binanceAddress.getAddress();
}
