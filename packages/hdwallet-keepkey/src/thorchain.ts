import * as Messages from "@keepkey/device-protocol/lib/messages_pb";
import * as ThorchainMessages from "@keepkey/device-protocol/lib/messages-thorchain_pb";
import * as core from "@shapeshiftoss/hdwallet-core";
import _ from "lodash";

import { Transport } from "./transport";

export function thorchainGetAccountPaths(msg: core.ThorchainGetAccountPaths): Array<core.ThorchainAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + core.slip44ByCoin("Thorchain"), 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}

export async function thorchainSignTx(transport: Transport, msg: core.ThorchainSignTx): Promise<any> {
  return transport.lockDuring(async () => {
    const signTx = new ThorchainMessages.ThorchainSignTx();
    signTx.setAddressNList(msg.addressNList);
    signTx.setAccountNumber(msg.account_number);
    signTx.setChainId(msg.chain_id);
    signTx.setFeeAmount(parseInt(msg.tx.fee.amount[0].amount));
    signTx.setGas(parseInt(msg.tx.fee.gas));
    signTx.setSequence(msg.sequence);
    if (msg.tx.memo !== undefined) signTx.setMemo(msg.tx.memo);
    signTx.setMsgCount(1);

    let resp = await transport.call(Messages.MessageType.MESSAGETYPE_THORCHAINSIGNTX, signTx, {
      msgTimeout: core.LONG_TIMEOUT,
      omitLock: true,
    });

    for (const m of msg.tx.msg) {
      if (resp.message_enum !== Messages.MessageType.MESSAGETYPE_THORCHAINMSGREQUEST) {
        throw new Error(`THORChain: unexpected response ${resp.message_type}`);
      }

      let ack;

      if (m.type === "thorchain/MsgSend") {
        if (m.value.amount.length !== 1) {
          throw new Error("THORChain: Multiple amounts per MsgSend not supported");
        }

        const denom = m.value.amount[0].denom;
        if (denom !== "rune") {
          throw new Error("THORChain: Unsupported denomination: " + denom);
        }

        const send = new ThorchainMessages.ThorchainMsgSend();
        send.setFromAddress(m.value.from_address);
        send.setToAddress(m.value.to_address);
        send.setAmount(m.value.amount[0].amount);

        ack = new ThorchainMessages.ThorchainMsgAck();
        ack.setSend(send);
      } else if (m.type === "thorchain/MsgDeposit") {
        if (m.value.coins.length !== 1) {
          throw new Error("THORChain: Multiple amounts per MsgDeposit not supported");
        }

        const coinAsset = m.value.coins[0].asset;
        if (coinAsset !== "THOR.RUNE") {
          throw new Error("THORChain: Unsupported coin asset: " + coinAsset);
        }

        const deposit = new ThorchainMessages.ThorchainMsgDeposit();
        deposit.setAsset(m.value.coins[0].asset);
        deposit.setAmount(m.value.coins[0].amount);
        deposit.setMemo(m.value.memo);
        deposit.setSigner(m.value.signer);

        ack = new ThorchainMessages.ThorchainMsgAck();
        ack.setDeposit(deposit);
      } else {
        throw new Error(`THORChain: Message ${m.type} is not yet supported`);
      }

      resp = await transport.call(Messages.MessageType.MESSAGETYPE_THORCHAINMSGACK, ack, {
        msgTimeout: core.LONG_TIMEOUT,
        omitLock: true,
      });
    }

    if (resp.message_enum !== Messages.MessageType.MESSAGETYPE_THORCHAINSIGNEDTX) {
      throw new Error(`THORChain: unexpected response ${resp.message_type}`);
    }

    const signedTx = resp.proto as ThorchainMessages.ThorchainSignedTx;

    const signed = _.cloneDeep(msg.tx);

    signed.signatures = [
      {
        signature: signedTx.getSignature_asB64(),
        pub_key: {
          type: "tendermint/PubKeySecp256k1",
          value: signedTx.getPublicKey_asB64(),
        },
      },
    ];

    return signed;
  });
}

export async function thorchainGetAddress(
  transport: Transport,
  msg: ThorchainMessages.ThorchainGetAddress.AsObject
): Promise<string> {
  const getAddr = new ThorchainMessages.ThorchainGetAddress();
  getAddr.setAddressNList(msg.addressNList);
  getAddr.setShowDisplay(msg.showDisplay !== false);
  if (msg.testnet !== undefined) getAddr.setTestnet(msg.testnet);
  const response = await transport.call(Messages.MessageType.MESSAGETYPE_THORCHAINGETADDRESS, getAddr, {
    msgTimeout: core.LONG_TIMEOUT,
  });

  const thorchainAddress = response.proto as ThorchainMessages.ThorchainAddress;
  return core.mustBeDefined(thorchainAddress.getAddress());
}
