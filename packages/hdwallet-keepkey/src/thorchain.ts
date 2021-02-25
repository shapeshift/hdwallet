import * as Core from "@shapeshiftoss/hdwallet-core";

import { KeepKeyTransport } from "./transport";

import {
  ThorchainGetAddress,
  ThorchainAddress,
  ThorchainSignTx,
  ThorchainMsgAck,
  ThorchainSignedTx,
  ThorchainMsgSend,
} from "@keepkey/device-protocol/lib/messages-thorchain_pb";
import { MessageType } from "@keepkey/device-protocol/lib/messages_pb";

import { cloneDeep } from "lodash";

export function thorchainGetAccountPaths(msg: Core.ThorchainGetAccountPaths): Array<Core.ThorchainAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + Core.slip44ByCoin("Thorchain"), 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}

export async function thorchainSignTx(transport: KeepKeyTransport, msg: Core.ThorchainSignTx): Promise<any> {
  return transport.lockDuring(async () => {
    const signTx = new ThorchainSignTx();
    signTx.setAddressNList(msg.addressNList);
    signTx.setAccountNumber(msg.account_number);
    signTx.setChainId(msg.chain_id);
    signTx.setFeeAmount(parseInt(msg.tx.fee.amount[0].amount));
    signTx.setGas(parseInt(msg.tx.fee.gas));
    signTx.setSequence(msg.sequence);
    if (msg.tx.memo !== undefined) signTx.setMemo(msg.tx.memo);
    signTx.setMsgCount(1);

    let resp = await transport.call(
      MessageType.MESSAGETYPE_THORCHAINSIGNTX,
      signTx,
      Core.LONG_TIMEOUT,
      /*omitLock=*/ true
    );

    if (resp.message_type === Core.Events.FAILURE) throw resp;

    for (let m of msg.tx.msg) {
      if (resp.message_enum !== MessageType.MESSAGETYPE_THORCHAINMSGREQUEST) {
        throw new Error(`THORChain: unexpected response ${resp.message_type}`);
      }

      let ack;

      if (m.type === "thorchain/MsgSend") {
        if (m.value.amount.length !== 1) {
          throw new Error("THORChain: Multiple amounts per msg not supported");
        }

        const denom = m.value.amount[0].denom;
        if (denom !== "rune") {
          throw new Error("THORChain: Unsupported denomination: " + denom);
        }

        const send = new ThorchainMsgSend();
        send.setFromAddress(m.value.from_address);
        send.setToAddress(m.value.to_address);
        send.setAmount(m.value.amount[0].amount);

        ack = new ThorchainMsgAck();
        ack.setSend(send);
      } else {
        throw new Error(`THORChain: Message ${m.type} is not yet supported`);
      }

      resp = await transport.call(MessageType.MESSAGETYPE_THORCHAINMSGACK, ack, Core.LONG_TIMEOUT, /*omitLock=*/ true);

      if (resp.message_type === Core.Events.FAILURE) throw resp;
    }

    if (resp.message_enum !== MessageType.MESSAGETYPE_THORCHAINSIGNEDTX) {
      throw new Error(`THORChain: unexpected response ${resp.message_type}`);
    }

    const signedTx = resp.proto as ThorchainSignedTx;

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

export async function thorchainGetAddress(transport: KeepKeyTransport, msg: ThorchainGetAddress.AsObject): Promise<string> {
  const getAddr = new ThorchainGetAddress();
  getAddr.setAddressNList(msg.addressNList);
  getAddr.setShowDisplay(msg.showDisplay !== false);
  const response = await transport.call(MessageType.MESSAGETYPE_THORCHAINGETADDRESS, getAddr, Core.LONG_TIMEOUT);

  if (response.message_type === Core.Events.FAILURE) throw response;

  const thorchainAddress = response.proto as ThorchainAddress;
  return thorchainAddress.getAddress();
}
