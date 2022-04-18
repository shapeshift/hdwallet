import type { AminoSignResponse, OfflineAminoSigner, StdSignDoc } from "@cosmjs/amino";
import type { AccountData } from "@cosmjs/proto-signing";
import * as Messages from "@keepkey/device-protocol/lib/messages_pb";
import * as CosmosMessages from "@keepkey/device-protocol/lib/messages-cosmos_pb";
import * as core from "@shapeshiftoss/hdwallet-core";
import * as bs58check from "bs58check";
import PLazy from "p-lazy";

import { Transport } from "./transport";

const protoTxBuilder = PLazy.from(() => import("@shapeshiftoss/proto-tx-builder"));

export function cosmosGetAccountPaths(msg: core.CosmosGetAccountPaths): Array<core.CosmosAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + core.slip44ByCoin("Atom"), 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}

export async function cosmosGetAddress(
  transport: Transport,
  msg: CosmosMessages.CosmosGetAddress.AsObject
): Promise<string> {
  const getAddr = new CosmosMessages.CosmosGetAddress();
  getAddr.setAddressNList(msg.addressNList);
  getAddr.setShowDisplay(msg.showDisplay !== false);
  const response = await transport.call(Messages.MessageType.MESSAGETYPE_COSMOSGETADDRESS, getAddr, {
    msgTimeout: core.LONG_TIMEOUT,
  });

  const cosmosAddress = response.proto as CosmosMessages.CosmosAddress;
  return core.mustBeDefined(cosmosAddress.getAddress());
}

export async function cosmosSignTx(transport: Transport, msg: core.CosmosSignTx): Promise<any> {
  const address = await cosmosGetAddress(transport, { addressNList: msg.addressNList });

  const getPublicKeyMsg = new Messages.GetPublicKey();
  getPublicKeyMsg.setAddressNList(msg.addressNList);
  getPublicKeyMsg.setEcdsaCurveName("secp256k1");

  const pubkeyMsg = (
    await transport.call(Messages.MessageType.MESSAGETYPE_GETPUBLICKEY, getPublicKeyMsg, {
      msgTimeout: core.DEFAULT_TIMEOUT,
    })
  ).proto as Messages.PublicKey;
  const pubkey = bs58check.decode(core.mustBeDefined(pubkeyMsg.getXpub())).slice(45);

  return transport.lockDuring(async () => {
    const signTx = new CosmosMessages.CosmosSignTx();
    signTx.setAddressNList(msg.addressNList);
    signTx.setAccountNumber(msg.account_number);
    signTx.setChainId(msg.chain_id);
    signTx.setFeeAmount(parseInt(msg.tx.fee.amount[0].amount));
    signTx.setGas(parseInt(msg.tx.fee.gas));
    signTx.setSequence(msg.sequence);
    if (msg.tx.memo !== undefined) {
      signTx.setMemo(msg.tx.memo);
    }
    signTx.setMsgCount(1);

    let resp = await transport.call(Messages.MessageType.MESSAGETYPE_COSMOSSIGNTX, signTx, {
      msgTimeout: core.LONG_TIMEOUT,
      omitLock: true,
    });

    for (const m of msg.tx.msg) {
      if (resp.message_enum !== Messages.MessageType.MESSAGETYPE_COSMOSMSGREQUEST) {
        throw new Error(`cosmos: unexpected response ${resp.message_type}`);
      }

      let ack;

      if (m.type === "cosmos-sdk/MsgSend") {
        if (m.value.amount.length !== 1) {
          throw new Error("cosmos: Multiple amounts per msg not supported");
        }

        const denom = m.value.amount[0].denom;
        if (denom !== "uatom") {
          throw new Error("cosmos: Unsupported denomination: " + denom);
        }

        const send = new CosmosMessages.CosmosMsgSend();
        send.setFromAddress(m.value.from_address);
        send.setToAddress(m.value.to_address);
        send.setAmount(m.value.amount[0].amount);

        ack = new CosmosMessages.CosmosMsgAck();
        ack.setSend(send);
      } else if (m.type === "cosmos-sdk/MsgDelegate") {
        const denom = m.value.amount.denom;
        if (denom !== "uatom") {
          throw new Error("cosmos: Unsupported denomination: " + denom);
        }

        const delegate = new CosmosMessages.CosmosMsgDelegate();
        delegate.setDelegatorAddress(m.value.delegator_address);
        delegate.setValidatorAddress(m.value.validator_address);
        delegate.setAmount(m.value.amount.amount);

        ack = new CosmosMessages.CosmosMsgAck();

        ack.setDelegate(delegate);
      } else if (m.type === "cosmos-sdk/MsgUndelegate") {
        const denom = m.value.amount.denom;
        if (denom !== "uatom") {
          throw new Error("cosmos: Unsupported denomination: " + denom);
        }

        const undelegate = new CosmosMessages.CosmosMsgUndelegate();
        undelegate.setDelegatorAddress(m.value.delegator_address);
        undelegate.setValidatorAddress(m.value.validator_address);
        undelegate.setAmount(m.value.amount.amount);

        ack = new CosmosMessages.CosmosMsgAck();
        ack.setUndelegate(undelegate);
      } else if (m.type === "cosmos-sdk/MsgBeginRedelegate") {
        const denom = m.value.amount.denom;
        if (denom !== "uatom") {
          throw new Error("cosmos: Unsupported denomination: " + denom);
        }

        const redelegate = new CosmosMessages.CosmosMsgRedelegate();
        redelegate.setDelegatorAddress(m.value.delegator_address);
        redelegate.setValidatorSrcAddress(m.value.validator_src_address);
        redelegate.setValidatorDstAddress(m.value.validator_dst_address);
        redelegate.setAmount(m.value.amount.amount);

        ack = new CosmosMessages.CosmosMsgAck();
        ack.setRedelegate(redelegate);
      } else if (m.type === "cosmos-sdk/MsgWithdrawDelegationReward") {
        const rewards = new CosmosMessages.CosmosMsgRewards();
        rewards.setDelegatorAddress(m.value.delegator_address);
        rewards.setValidatorAddress(m.value.validator_address);
        if (m.value.amount) {
          const denom = m.value.amount.denom;
          if (denom !== "uatom") {
            throw new Error("cosmos: Unsupported denomination: " + denom);
          }
          rewards.setAmount(m.value.amount.amount);
        }

        ack = new CosmosMessages.CosmosMsgAck();
        ack.setRewards(rewards);
      } else if (m.type === "cosmos-sdk/MsgTransfer") {
        const denom = m.value.token.denom;
        if (denom !== "uatom") {
          throw new Error("cosmos: Unsupported denomination: " + denom);
        }

        const ibcTransfer = new CosmosMessages.CosmosMsgIBCTransfer();
        ibcTransfer.setReceiver(m.value.receiver);
        ibcTransfer.setSender(m.value.sender);
        ibcTransfer.setSourceChannel(m.value.source_channel);
        ibcTransfer.setSourcePort(m.value.source_port);
        ibcTransfer.setRevisionHeight(m.value.timeout_height.revision_height);
        ibcTransfer.setRevisionNumber(m.value.timeout_height.revision_number);
        ibcTransfer.setAmount(m.value.token.amount);
        ibcTransfer.setDenom(m.value.token.denom);

        ack = new CosmosMessages.CosmosMsgAck();
        ack.setIbcTransfer(ibcTransfer);
      } else {
        throw new Error(`cosmos: Message ${m.type} is not yet supported`);
      }

      resp = await transport.call(Messages.MessageType.MESSAGETYPE_COSMOSMSGACK, ack, {
        msgTimeout: core.LONG_TIMEOUT,
        omitLock: true,
      });
    }

    if (resp.message_enum !== Messages.MessageType.MESSAGETYPE_COSMOSSIGNEDTX) {
      throw new Error(`cosmos: unexpected response ${resp.message_type}`);
    }

    const signedTx = resp.proto as CosmosMessages.CosmosSignedTx;

    const offlineSigner: OfflineAminoSigner = {
      async getAccounts(): Promise<readonly AccountData[]> {
        return [
          {
            address,
            algo: "secp256k1",
            pubkey,
          },
        ];
      },
      async signAmino(signerAddress: string, signDoc: StdSignDoc): Promise<AminoSignResponse> {
        if (signerAddress !== address) throw new Error("expected signerAddress to match address");
        return {
          signed: signDoc,
          signature: {
            pub_key: {
              type: "tendermint/PubKeySecp256k1",
              value: signedTx.getPublicKey_asB64(),
            },
            signature: signedTx.getSignature_asB64(),
          },
        };
      },
    };
    return await (await protoTxBuilder).sign(msg.tx, offlineSigner, msg.sequence, msg.account_number, msg.chain_id);
  });
}
