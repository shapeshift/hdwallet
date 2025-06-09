import type { AccountData, AminoSignResponse, OfflineAminoSigner, StdSignDoc, StdTx } from "@cosmjs/amino";
import type { SignerData } from "@cosmjs/stargate";
import * as Messages from "@keepkey/device-protocol/lib/messages_pb";
import * as MayachainMessages from "@keepkey/device-protocol/lib/messages-mayachain_pb";
import * as core from "@shapeshiftoss/hdwallet-core";
import bs58check from "bs58check";
import PLazy from "p-lazy";

import { Transport } from "./transport";

const protoTxBuilder = PLazy.from(() => import("@shapeshiftoss/proto-tx-builder"));

export function mayachainGetAccountPaths(msg: core.MayachainGetAccountPaths): Array<core.MayachainAccountPath> {
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + core.slip44ByCoin("Mayachain"), 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
}

export async function mayachainGetAddress(
  transport: Transport,
  msg: MayachainMessages.MayachainGetAddress.AsObject
): Promise<string> {
  const getAddr = new MayachainMessages.MayachainGetAddress();
  getAddr.setAddressNList(msg.addressNList);
  getAddr.setShowDisplay(msg.showDisplay !== false);

  if (msg.testnet !== undefined) getAddr.setTestnet(msg.testnet);

  const response = await transport.call(Messages.MessageType.MESSAGETYPE_MAYACHAINGETADDRESS, getAddr, {
    msgTimeout: core.LONG_TIMEOUT,
  });

  const mayachainAddress = response.proto as MayachainMessages.MayachainAddress;

  return core.mustBeDefined(mayachainAddress.getAddress());
}

export async function mayachainSignTx(
  transport: Transport,
  msg: core.MayachainSignTx
): Promise<core.MayachainSignedTx> {
  const address = await mayachainGetAddress(transport, { addressNList: msg.addressNList });

  const getPublicKeyMsg = new Messages.GetPublicKey();
  getPublicKeyMsg.setAddressNList(msg.addressNList);
  getPublicKeyMsg.setEcdsaCurveName("secp256k1");

  const response = await transport.call(Messages.MessageType.MESSAGETYPE_GETPUBLICKEY, getPublicKeyMsg, {
    msgTimeout: core.DEFAULT_TIMEOUT,
  });

  const pubkeyMsg = response.proto as Messages.PublicKey;
  const pubkey = bs58check.decode(core.mustBeDefined(pubkeyMsg.getXpub())).subarray(45);

  return transport.lockDuring(async () => {
    const signTx = new MayachainMessages.MayachainSignTx();
    signTx.setAddressNList(msg.addressNList);
    signTx.setAccountNumber(msg.account_number);
    signTx.setChainId(msg.chain_id);
    signTx.setFeeAmount(parseInt(msg.tx.fee.amount[0].amount));
    signTx.setGas(parseInt(msg.tx.fee.gas));
    signTx.setSequence(msg.sequence);

    if (msg.tx.memo !== undefined) signTx.setMemo(msg.tx.memo);
    signTx.setMsgCount(1);

    let resp = await transport.call(Messages.MessageType.MESSAGETYPE_MAYACHAINSIGNTX, signTx, {
      msgTimeout: core.LONG_TIMEOUT,
      omitLock: true,
    });

    for (const m of msg.tx.msg) {
      if (resp.message_enum !== Messages.MessageType.MESSAGETYPE_MAYACHAINMSGREQUEST) {
        throw new Error(`Unexpected response: ${resp.message_type}`);
      }

      const msgAck = new MayachainMessages.MayachainMsgAck();

      switch (m.type) {
        case "mayachain/MsgSend": {
          if (m.value.amount.length !== 1) {
            throw new Error("Multiple amounts per MsgSend not supported");
          }

          const denom = m.value.amount[0].denom;
          if (denom !== "cacao") throw new Error(`Unsupported denomination: ${denom}`);

          const send = new MayachainMessages.MayachainMsgSend();
          send.setFromAddress(m.value.from_address);
          send.setToAddress(m.value.to_address);
          send.setAmount(m.value.amount[0].amount);
          send.setDenom(denom);

          msgAck.setSend(send);

          break;
        }
        case "mayachain/MsgDeposit": {
          if (m.value.coins.length !== 1) {
            throw new Error("Multiple amounts per MsgDeposit not supported");
          }

          const coinAsset = m.value.coins[0].asset;
          if (coinAsset !== "MAYA.CACAO") throw new Error(`Unsupported coin asset: ${coinAsset}`);

          const deposit = new MayachainMessages.MayachainMsgDeposit();
          deposit.setAsset(m.value.coins[0].asset);
          deposit.setAmount(m.value.coins[0].amount);
          deposit.setMemo(m.value.memo);
          deposit.setSigner(m.value.signer);

          msgAck.setDeposit(deposit);

          break;
        }
        default:
          throw new Error(`Message ${m.type} is not yet supported`);
      }

      resp = await transport.call(Messages.MessageType.MESSAGETYPE_MAYACHAINMSGACK, msgAck, {
        msgTimeout: core.LONG_TIMEOUT,
        omitLock: true,
      });
    }

    if (resp.message_enum !== Messages.MessageType.MESSAGETYPE_MAYACHAINSIGNEDTX) {
      throw new Error(`Unexpected response: ${resp.message_type}`);
    }

    const signedTx = resp.proto as MayachainMessages.MayachainSignedTx;

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

    const signerData: SignerData = {
      sequence: Number(msg.sequence),
      accountNumber: Number(msg.account_number),
      chainId: msg.chain_id,
    };

    return (await protoTxBuilder).sign(address, msg.tx as StdTx, offlineSigner, signerData, "maya");
  });
}
