import type { AminoSignResponse, OfflineAminoSigner, StdSignDoc } from "@cosmjs/amino";
import type { AccountData } from "@cosmjs/proto-signing";
import * as Messages from "@keepkey/device-protocol/lib/messages_pb";
import * as OsmosisMessages from "@keepkey/device-protocol/lib/messages-osmosis_pb";
import * as core from "@shapeshiftoss/hdwallet-core";
import * as bs58check from "bs58check";
import PLazy from "p-lazy";

import { Transport } from "./transport";

const protoTxBuilder = PLazy.from(() => import("@shapeshiftoss/proto-tx-builder"));

export async function osmosisSupportsLegacyAminoSigning(): Promise<boolean> {
  return true;
}

export async function osmosisSupportsProtobufSigning(): Promise<boolean> {
  return false;
}

export function osmosisGetAccountPaths(msg: core.OsmosisGetAccountPaths): Array<core.OsmosisAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + core.slip44ByCoin("Atom"), 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}

export async function osmosisGetAddress(
  transport: Transport,
  msg: OsmosisMessages.OsmosisGetAddress.AsObject
): Promise<string> {
  const getAddr = new OsmosisMessages.OsmosisGetAddress();
  getAddr.setAddressNList(msg.addressNList);
  getAddr.setShowDisplay(msg.showDisplay !== false);
  const response = await transport.call(Messages.MessageType.MESSAGETYPE_OSMOSISGETADDRESS, getAddr, {
    msgTimeout: core.LONG_TIMEOUT,
  });

  const osmosisAddress = response.proto as OsmosisMessages.OsmosisAddress;
  return core.mustBeDefined(osmosisAddress.getAddress());
}

export async function osmosisSignTx(transport: Transport, msg: core.OsmosisSignTx): Promise<any> {
  const address = await osmosisGetAddress(transport, { addressNList: msg.addressNList });

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
    const signTx = new OsmosisMessages.OsmosisSignTx();
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
        throw new Error(`osmosis: unexpected response ${resp.message_type}`);
      }

      let ack;
      if (m.type === "osmosis-sdk/MsgSend") {
        // Transfer
        if (m.value.amount.length !== 1) {
          throw new Error("osmosis: Multiple amounts per msg not supported");
        }

        const denom = m.value.amount[0].denom;
        if (denom !== "uatom") {
          throw new Error("osmosis: Unsupported denomination: " + denom);
        }

        const send = new OsmosisMessages.OsmosisMsgSend();
        send.setFromAddress(m.value.from_address);
        send.setToAddress(m.value.to_address);
        send.setDenom(m.value.amount[0].denom);
        send.setAmount(m.value.amount[0].amount);

        ack = new OsmosisMessages.OsmosisMsgAck();
        ack.setSend(send);
      } else if (m.type === "cosmos-sdk/MsgDelegate") {
        // Delegate
        const denom = m.value.amount.denom;
        if (denom !== "uatom") {
          throw new Error("osmosis: Unsupported denomination: " + denom);
        }

        const delegate = new OsmosisMessages.OsmosisMsgDelegate();
        delegate.setDelegatorAddress(m.value.delegator_address);
        delegate.setValidatorAddress(m.value.validator_address);
        delegate.setDenom(m.value.amount[0].denom);
        delegate.setAmount(m.value.amount[0].amount);

        ack = new OsmosisMessages.OsmosisMsgAck();
        ack.setDelegate(delegate);
      } else if (m.type === "cosmos-sdk/MsgUndelegate") {
        // Undelegate
        const denom = m.value.amount.denom;
        if (denom !== "uatom") {
          throw new Error("osmosis: Unsupported denomination: " + denom);
        }

        const undelegate = new OsmosisMessages.OsmosisMsgUndelegate();
        undelegate.setDelegatorAddress(m.value.delegator_address);
        undelegate.setValidatorAddress(m.value.validator_address);
        undelegate.setDenom(m.value.amount[0].denom);
        undelegate.setAmount(m.value.amount[0].amount);

        ack = new OsmosisMessages.OsmosisMsgAck();
        ack.setUndelegate(undelegate);
      } else if (m.type === "cosmos-sdk/MsgBeginRedelegate") {
        // Redelegate
        const denom = m.value.amount.denom;
        if (denom !== "uatom") {
          throw new Error("osmosis: Unsupported denomination: " + denom);
        }

        const redelegate = new OsmosisMessages.OsmosisMsgRedelegate();
        redelegate.setDelegatorAddress(m.value.delegator_address);
        redelegate.setValidatorSrcAddress(m.value.validator_src_address);
        redelegate.setValidatorDstAddress(m.value.validator_dst_address);
        redelegate.setAmount(m.value.amount.amount);

        ack = new OsmosisMessages.OsmosisMsgAck();
        ack.setRedelegate(redelegate);
      } else if (m.type === "cosmos-sdk/MsgWithdrawDelegatorReward") {
        // Rewards
        const denom = m.value.amount.denom;
        if (denom !== "uatom") {
          throw new Error("osmosis: Unsupported denomination: " + denom);
        }

        const rewards = new OsmosisMessages.OsmosisMsgRewards();
        rewards.setDelegatorAddress(m.value.delegator_address);
        rewards.setValidatorAddress(m.value.validator_address);
        rewards.setAmount(m.value.amount.amount);

        ack = new OsmosisMessages.OsmosisMsgAck();
        ack.setRewards(rewards);
      } else if (m.type == "osmosis/gamm/join-pool") {
        // LP add
        const lpAdd = new OsmosisMessages.OsmosisMsgLPAdd();
        lpAdd.setSender(m.value.sender);
        lpAdd.setShareOutAmount(m.value.shareOutAmount);
        lpAdd.setDenomInMaxA(m.value.tokenInMaxs[0].denom);
        lpAdd.setAmountInMaxA(m.value.tokenInMaxs[0].amount);
        lpAdd.setDenomInMaxB(m.value.tokenInMaxs[1].denom);
        lpAdd.setAmountInMaxB(m.value.tokenInMaxs[1].amount);

        ack = new OsmosisMessages.OsmosisMsgAck();
        ack.setLpAdd(lpAdd);
      } else if (m.type === "osmosis/gamm/exit-pool") {
        // LP remove
        const lpRemove = new OsmosisMessages.OsmosisMsgLPRemove();
        lpRemove.setSender(m.value.sender);
        lpRemove.setShareOutAmount(m.value.shareOutAmount);
        lpRemove.setDenomOutMinA(m.value.tokenInMaxs[0].denom);
        lpRemove.setAmountOutMinA(m.value.tokenInMaxs[0].amount);
        lpRemove.setDenomOutMinB(m.value.tokenInMaxs[1].denom);
        lpRemove.setAmountOutMinB(m.value.tokenInMaxs[1].amount);

        ack = new OsmosisMessages.OsmosisMsgAck();
        ack.setLpRemove(lpRemove);
      } else if (m.type === "osmosis/lockup/lock-tokens") {
        // LP stake
        const lpStake = new OsmosisMessages.OsmosisMsgLPStake();
        lpStake.setOwner(m.value.owner);
        lpStake.setDuration(m.value.duration);
        lpStake.setDenom(m.value.coins[0].denom);
        lpStake.setAmount(m.value.coins[0].amount);

        ack = new OsmosisMessages.OsmosisMsgAck();
        ack.setLpStake(lpStake);
      } else if (m.type === "osmosis/lockup/begin-unlock-period-lock") {
        // LP unstake
        const lpUnstake = new OsmosisMessages.OsmosisMsgLPUnstake();
        lpUnstake.setOwner(m.value.owner);
        lpUnstake.setId(m.value.id);

        ack = new OsmosisMessages.OsmosisMsgAck();
        ack.setLpUnstake(lpUnstake);
      } else if (m.type === "osmosis-sdk/MsgTransfer") {
        // IBC Transfer
        const denom = m.value.token.denom;
        if (denom !== "uatom") {
          throw new Error("osmosis: Unsupported denomination: " + denom);
        }

        const ibcTransfer = new OsmosisMessages.OsmosisMsgIBCTransfer();
        ibcTransfer.setReceiver(m.value.receiver);
        ibcTransfer.setSender(m.value.sender);
        ibcTransfer.setSourceChannel(m.value.source_channel);
        ibcTransfer.setSourcePort(m.value.source_port);
        ibcTransfer.setRevisionHeight(m.value.timeout_height.revision_height);
        ibcTransfer.setRevisionNumber(m.value.timeout_height.revision_number);
        ibcTransfer.setAmount(m.value.token.amount);
        ibcTransfer.setDenom(m.value.token.denom);

        ack = new OsmosisMessages.OsmosisMsgAck();
        ack.setIbcTransfer(ibcTransfer);
      } else if (m.type === "osmosis/gamm/swap-exact-amount-in") {
        // Swap
        const swap = new OsmosisMessages.OsmosisMsgSwap();
        swap.setSender(m.value.sender);
        swap.setPoolId(m.value.routes[0].poolId);
        swap.setTokenOutDenom(m.value.routes[0].tokenOutDenom);
        swap.setTokenInDenom(m.value.tokenIn.denom);
        swap.setTokenInAmount(m.value.tokenIn.amount);
        swap.setTokenOutMinAmount(m.value.tokenOutMinAmount);

        ack = new OsmosisMessages.OsmosisMsgAck();
        ack.setSwap(swap);
      } else {
        throw new Error(`osmosis: Message ${m.type} is not yet supported`);
      }

      resp = await transport.call(Messages.MessageType.MESSAGETYPE_COSMOSMSGACK, ack, {
        msgTimeout: core.LONG_TIMEOUT,
        omitLock: true,
      });
    }

    if (resp.message_enum !== Messages.MessageType.MESSAGETYPE_COSMOSSIGNEDTX) {
      throw new Error(`osmosis: unexpected response ${resp.message_type}`);
    }

    const signedTx = resp.proto as OsmosisMessages.OsmosisSignedTx;

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
