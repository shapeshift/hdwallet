import * as Core from "@shapeshiftoss/hdwallet-core";

import { KeepKeyTransport } from "./transport";

import {
  TendermintGetAddress,
  TendermintAddress,
  TendermintSignTx,
  TendermintMsgAck,
  TendermintSignedTx,
  TendermintMsgSend,
} from "@keepkey/device-protocol/lib/messages-tendermint_pb";
import { MessageType } from "@keepkey/device-protocol/lib/messages_pb";

import { cloneDeep, indexOf } from "lodash";

export function tendermintGetAccountPaths(msg: Core.TendermintGetAccountPaths, coin: string): Array<Core.TendermintAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + Core.slip44ByCoin(coin), 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}

export async function tendermintSignTx(transport: KeepKeyTransport, msg: Core.TendermintSignTx): Promise<any> {
  /** TODO: Look up coin/chain and get pre-generated signature from imported package. 
   *        Append signature to signTx protobuf message */
  return transport.lockDuring(async () => {
    const signTx = new TendermintSignTx();
    signTx.setAccountNumber(msg.account_number);
    signTx.setAddressNList(msg.addressNList);
    signTx.setChainId(msg.chain_id);
    signTx.setChainName(msg.chain_name);
    signTx.setDecimals(parseInt(msg.decimals));
    signTx.setDenom(msg.denom);
    signTx.setFeeAmount(parseInt(msg.tx.fee.amount[0].amount));
    signTx.setGas(parseInt(msg.tx.fee.gas));
    signTx.setMessageTypePrefix(msg.message_type_prefix);
    signTx.setSequence(msg.sequence);
    signTx.setTestnet(msg.testnet);
    if (msg.tx.memo !== undefined) signTx.setMemo(msg.tx.memo);
    signTx.setMsgCount(1);

    let resp = await transport.call(
      MessageType.MESSAGETYPE_TENDERMINTSIGNTX,
      signTx,
      Core.LONG_TIMEOUT,
      /*omitLock=*/ true
    );

    if (resp.message_type === Core.Events.FAILURE){
      console.log("ERROR", resp);
      throw resp;
    }

    for (let m of msg.tx.msg) {
      console.log(msg.tx.msg);
      if (resp.message_enum !== MessageType.MESSAGETYPE_TENDERMINTMSGREQUEST) {
        throw new Error(`tendermint: unexpected response ${resp.message_type}`);
      }

      let ack;
      if(m.type.substring(m.type.indexOf('/') + 1) === "MsgSend"){
        if (m.value.amount.length !== 1) {
          throw new Error("tendermint: Multiple amounts per msg not supported");
        }

        // const denom = m.value.amount[0].denom;
        // if (denom !== "uatom") {
        //   throw new Error("tendermint: Unsupported denomination: " + denom);
        // }

        const send = new TendermintMsgSend();
        send.setFromAddress(m.value.from_address);
        send.setToAddress(m.value.to_address);
        send.setAmount(m.value.amount[0].amount);

        ack = new TendermintMsgAck();
        ack.setSend(send);
      } else {
        throw new Error(`tendermint: Message ${m.type} is not yet supported`);
      }

      resp = await transport.call(MessageType.MESSAGETYPE_TENDERMINTMSGACK, ack, Core.LONG_TIMEOUT, /*omitLock=*/ true);

      if (resp.message_type === Core.Events.FAILURE) throw resp;
    }

    if (resp.message_enum !== MessageType.MESSAGETYPE_TENDERMINTSIGNEDTX) {
      throw new Error(`tendermint: unexpected response ${resp.message_type}`);
    }

    const signedTx = resp.proto as TendermintSignedTx;

    const signed = cloneDeep(msg.tx);

    signed.signatures = [
      {
        pub_key: {
          type: "tendermint/PubKeySecp256k1",
          value: signedTx.getPublicKey_asB64(),
        },
        signature: signedTx.getSignature_asB64(),
      },
    ];

    return signed;
  });
}

export async function tendermintGetAddress(transport: KeepKeyTransport, msg: TendermintGetAddress.AsObject): Promise<string> {
  const getAddr = new TendermintGetAddress();
  getAddr.setAddressNList(msg.addressNList);
  getAddr.setShowDisplay(msg.showDisplay !== false);
  const response = await transport.call(MessageType.MESSAGETYPE_TENDERMINTGETADDRESS, getAddr, Core.LONG_TIMEOUT);

  if (response.message_type === Core.Events.FAILURE) throw response;

  const tendermintAddress = response.proto as TendermintAddress;
  return tendermintAddress.getAddress();
}
