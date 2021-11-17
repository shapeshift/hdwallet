import * as OsmosisMessages from "@keepkey/device-protocol/lib/messages-osmosis_pb";
import * as Messages from "@keepkey/device-protocol/lib/messages_pb";
import * as core from "@shapeshiftoss/hdwallet-core";
import _ from "lodash";

import { Transport } from "./transport";

export function osmosisGetAccountPaths(msg: core.OsmosisGetAccountPaths): Array<core.OsmosisAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + core.slip44ByCoin("Osmo"), 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}

export async function osmosisSignTx(transport: Transport, msg: core.OsmosisSignTx): Promise<any> {
  return transport.lockDuring(async () => {
    const signTx = new OsmosisMessages.OsmosisSignTx();
    signTx.setAddressNList(msg.addressNList);
    signTx.setAccountNumber(msg.account_number);
    signTx.setChainId(msg.chain_id);
    signTx.setFeeAmount(parseInt(msg.tx.fee.amount[0].amount));
    signTx.setGas(parseInt(msg.tx.fee.gas));
    signTx.setSequence(msg.sequence);
    if (msg.tx.memo !== undefined) signTx.setMemo(msg.tx.memo);
    signTx.setMsgCount(1);

    let resp = await transport.call(
      Messages.MessageType.MESSAGETYPE_OSMOSISSIGNTX,
      signTx,
      core.LONG_TIMEOUT,
      /*omitLock=*/ true
    );

    if (resp.message_type === core.Events.FAILURE) throw resp;

    for (let m of msg.tx.msg) {
      if (resp.message_enum !== Messages.MessageType.MESSAGETYPE_OSMOSISMSGREQUEST) {
        throw new Error(`THORChain: unexpected response ${resp.message_type}`);
      }

      let ack;

      if (m.type === "cosmos-sdk/MsgSend") {
        const denom = m.value.amount[0].denom;
        if (denom !== "uosmo") {
          console.error(JSON.stringify(m));
          throw new Error("Osmosis: Unsupported denomination: " + denom);
        }

        const send = new OsmosisMessages.OsmosisMsgSend();
        send.setFromAddress(m.value.from_address);
        send.setToAddress(m.value.to_address);

        const token = new OsmosisMessages.OsmosisToken();
        token.setAmount(m.value.amount[0].amount);
        token.setDenom(m.value.amount[0].denom);
        send.setToken(token);

        ack = new OsmosisMessages.OsmosisMsgAck();
        ack.setSend(send);
      } else if (m.type === "cosmos-sdk/MsgDelegate") {
        const denom = m.value.amount.denom;
        if (denom !== "uosmo") {
          throw new Error("Osmosis: Unsupported denomination: " + denom);
        }

        const delegate = new OsmosisMessages.OsmosisMsgDelegate();
        delegate.setDelegatorAddress(m.value.delegator_address);
        delegate.setValidatorAddress(m.value.validator_address);
        const token = new OsmosisMessages.OsmosisToken();
        token.setAmount(m.value.amount.amount);
        token.setDenom(m.value.amount.denom);
        delegate.setToken(token);

        ack = new OsmosisMessages.OsmosisMsgAck();
        ack.setDelegate(delegate);
      } else if (m.type === "cosmos-sdk/MsgUndelegate") {
        const denom = m.value.amount.denom;
        if (denom !== "uosmo") {
          throw new Error("Osmosis: Unsupported denomination: " + denom);
        }

        const undelegate = new OsmosisMessages.OsmosisMsgUndelegate();
        undelegate.setDelegatorAddress(m.value.delegator_address);
        undelegate.setValidatorAddress(m.value.validator_address);
        const token = new OsmosisMessages.OsmosisToken();
        token.setAmount(m.value.amount.amount);
        token.setDenom(m.value.amount.denom);
        undelegate.setToken(token);

        ack = new OsmosisMessages.OsmosisMsgAck();
        ack.setUndelegate(undelegate);
      } else if (m.type === "cosmos-sdk/MsgWithdrawDelegatorReward") {
        const denom = m.value.amount.denom;
        if (denom !== "uosmo") {
          throw new Error("Osmosis: Unsupported denomination: " + denom);
        }

        const claim = new OsmosisMessages.OsmosisMsgClaim();
        claim.setDelegatorAddress(m.value.delegator_address);
        claim.setValidatorAddress(m.value.validator_address);
        const token = new OsmosisMessages.OsmosisToken();
        token.setAmount(m.value.amount.amount);
        token.setDenom(m.value.amount.denom);
        claim.setToken(token);

        ack = new OsmosisMessages.OsmosisMsgAck();
        ack.setClaim(claim);
      } else if (m.type === "osmosis/gamm/join-pool") {
        const lpAdd = new OsmosisMessages.OsmosisMsgLPAdd();
        lpAdd.setSender(m.value.delegator_address);
        lpAdd.setPoolId(m.value.validator_address);
        lpAdd.setShareOutAmount(m.value.validator_address);
        const tokenInMaxA = new OsmosisMessages.OsmosisToken();
        tokenInMaxA.setAmount(m.value.tokenInMaxs[0].amount);
        tokenInMaxA.setDenom(m.value.tokenInMaxs[0].denom);
        lpAdd.setTokenInMaxA(tokenInMaxA);
        const tokenInMaxB = new OsmosisMessages.OsmosisToken();
        tokenInMaxB.setAmount(m.value.tokenInMaxs[1].amount);
        tokenInMaxB.setDenom(m.value.tokenInMaxs[1].denom);
        lpAdd.setTokenInMaxB(tokenInMaxB);

        ack = new OsmosisMessages.OsmosisMsgAck();
        ack.setLpAdd(lpAdd);
      } else if (m.type === "osmosis/gamm/exit-pool") {
        const lpRemove = new OsmosisMessages.OsmosisMsgLPRemove();
        lpRemove.setSender(m.value.delegator_address);
        lpRemove.setPoolId(m.value.validator_address);
        lpRemove.setShareOutAmount(m.value.validator_address);
        const tokenOutMinA = new OsmosisMessages.OsmosisToken();
        tokenOutMinA.setAmount(m.value.tokenOutMins[0].amount);
        tokenOutMinA.setDenom(m.value.tokenOutMins[0].denom);
        lpRemove.setTokenOutMinA(tokenOutMinA);
        const tokenOutMinB = new OsmosisMessages.OsmosisToken();
        tokenOutMinB.setAmount(m.value.tokenOutMins[1].amount);
        tokenOutMinB.setDenom(m.value.tokenOutMins[1].denom);
        lpRemove.setTokenOutMinB(tokenOutMinB);

        ack = new OsmosisMessages.OsmosisMsgAck();
        ack.setLpRemove(lpRemove);
      } else if (m.type === "osmosis/lockup/lock-tokens") {
        const farmTokens = new OsmosisMessages.OsmosisMsgFarmTokens();
        farmTokens.setOwner(m.value.ownerr);
        farmTokens.setDuration(m.value.duration);
        const token = new OsmosisMessages.OsmosisToken();
        token.setAmount(m.value.coins.amount);
        token.setDenom(m.value.coins.denom);
        farmTokens.setToken(token);

        ack = new OsmosisMessages.OsmosisMsgAck();
        ack.setFarmTokens(farmTokens);
      } else if (m.type === "cosmos-sdk/MsgTransfer") {
        if (m.value.source_channel === "channel-141") {
          const ibcDeposit = new OsmosisMessages.OsmosisMsgIBCDeposit();
          ibcDeposit.setSourcePort(m.value.source_port);
          ibcDeposit.setSourceChannel(m.value.source_channel);
          const token = new OsmosisMessages.OsmosisToken();
          token.setAmount(m.value.token.amount);
          token.setDenom(m.value.token.denom);
          ibcDeposit.setToken(token);

          ibcDeposit.setSender(m.value.sender);
          ibcDeposit.setReceiver(m.value.receiver);
          const timeout_height = new OsmosisMessages.OsmosisTimeoutHeight();

          timeout_height.setRevisionNumber(m.value.timeout_height.revision_number);
          timeout_height.setRevisionHeight(m.value.timeout_height.revision_height);
          ibcDeposit.setTimeoutHeight(timeout_height);

          ack = new OsmosisMessages.OsmosisMsgAck();
          ack.setIbcDeposit(ibcDeposit);
        } else if (m.value.source_channel === "channel-0") {
          const ibcWithdrawal = new OsmosisMessages.OsmosisMsgIBCWithdrawal();
          ibcWithdrawal.setSourcePort(m.value.source_port);
          ibcWithdrawal.setSourceChannel(m.value.source_channel);
          const token = new OsmosisMessages.OsmosisToken();
          token.setAmount(m.value.token.amount);
          token.setDenom(m.value.token.denom);
          ibcWithdrawal.setToken(token);

          ibcWithdrawal.setSender(m.value.sender);
          ibcWithdrawal.setReceiver(m.value.receiver);
          const timeout_height = new OsmosisMessages.OsmosisTimeoutHeight();

          timeout_height.setRevisionNumber(m.value.timeout_height.revision_number);
          timeout_height.setRevisionHeight(m.value.timeout_height.revision_height);
          ibcWithdrawal.setTimeoutHeight(timeout_height);

          ack = new OsmosisMessages.OsmosisMsgAck();
          ack.setIbcWithdrawal(ibcWithdrawal);
        } else {
          console.error(
            "Channel must be set to 'channel-141' for IBC deposit or 'channel-0' for IBC withdrawal example transactions"
          );
        }
      } else if (m.type === "osmosis/gamm/swap-exact-amount-in") {
        const swap = new OsmosisMessages.OsmosisMsgSwap();
        swap.setSender(m.value.sender);
        swap.setPoolId(m.value.routes[0].poolId);
        swap.setTokenOutDenom(m.value.routes[0].tokenOutDenom);
        const token = new OsmosisMessages.OsmosisToken();
        token.setAmount(m.value.tokenIn.amount);
        token.setDenom(m.value.tokenIn.denom);
        swap.setTokenIn(token);
        swap.setTokenOutMinAmount(m.value.tokenOutMinAmount);

        ack = new OsmosisMessages.OsmosisMsgAck();
        ack.setSwap(swap);
      } else {
        throw new Error(`Osmosis: Message ${m.type} is not yet supported`);
      }

      resp = await transport.call(
        Messages.MessageType.MESSAGETYPE_OSMOSISMSGACK,
        ack,
        core.LONG_TIMEOUT,
        /*omitLock=*/ true
      );

      if (resp.message_type === core.Events.FAILURE) throw resp;
    }

    if (resp.message_enum !== Messages.MessageType.MESSAGETYPE_OSMOSISSIGNEDTX) {
      throw new Error(`Osmosis: unexpected response ${resp.message_type}`);
    }

    const signedTx = resp.proto as OsmosisMessages.OsmosisSignedTx;

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

export async function osmosisGetAddress(
  transport: Transport,
  msg: OsmosisMessages.OsmosisGetAddress.AsObject
): Promise<string> {
  const getAddr = new OsmosisMessages.OsmosisGetAddress();
  getAddr.setAddressNList(msg.addressNList);
  getAddr.setShowDisplay(msg.showDisplay !== false);
  if (msg.testnet !== undefined) getAddr.setTestnet(msg.testnet);
  const response = await transport.call(Messages.MessageType.MESSAGETYPE_OSMOSISGETADDRESS, getAddr, core.LONG_TIMEOUT);

  if (response.message_type === core.Events.FAILURE) throw response;

  const osmosisAddress = response.proto as OsmosisMessages.OsmosisAddress;
  return core.mustBeDefined(osmosisAddress.getAddress());
}
