import type { AccountData, AminoSignResponse, OfflineAminoSigner, StdSignDoc, StdTx } from "@cosmjs/amino";
import { Secp256k1Signature } from "@cosmjs/crypto";
import type { SignerData } from "@cosmjs/stargate";
import * as core from "@shapeshiftoss/hdwallet-core";
import { fromByteArray } from "base64-js";
import PLazy from "p-lazy";

import { handleError, LedgerTransport, stringifyKeysInOrder } from "./index";

const protoTxBuilder = PLazy.from(() => import("@shapeshiftoss/proto-tx-builder"));

export const mayachainGetAddress = async (
  transport: LedgerTransport,
  msg: core.MayachainGetAddress
): Promise<string> => {
  const res = await transport.call("Thorchain", "getAddress", msg.addressNList, "maya", msg.showDisplay);

  handleError(res, transport, "Unable to obtain address and public key from device.");

  return res.payload.address;
};

export const mayachainSignTx = async (
  transport: LedgerTransport,
  msg: core.MayachainSignTx
): Promise<core.MayachainSignedTx> => {
  const getAddressResponse = await transport.call("Thorchain", "getAddress", msg.addressNList, "maya", false);

  handleError(getAddressResponse, transport, "Unable to obtain address and public key from device.");

  const { address, publicKey } = getAddressResponse.payload;

  const unsignedTx = stringifyKeysInOrder({
    account_number: msg.account_number,
    chain_id: msg.chain_id,
    fee: { amount: msg.tx.fee.amount, gas: msg.tx.fee.gas },
    memo: msg.tx.memo,
    msgs: msg.tx.msg,
    sequence: msg.sequence,
  });

  const signResponse = await transport.call("Thorchain", "sign", msg.addressNList, unsignedTx);

  handleError(signResponse, transport, "Unable to obtain signature from device.");

  const signature = signResponse.payload.signature;

  if (!signature) throw new Error("No signature returned from device");

  const offlineSigner: OfflineAminoSigner = {
    async getAccounts(): Promise<readonly AccountData[]> {
      return [
        {
          address,
          algo: "secp256k1",
          pubkey: Buffer.from(publicKey, "hex"),
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
            value: publicKey,
          },
          signature: fromByteArray(Secp256k1Signature.fromDer(signature).toFixedLength()),
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
};
