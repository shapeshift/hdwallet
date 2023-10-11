import type { AccountData, AminoSignResponse, OfflineAminoSigner, StdSignDoc, StdTx } from "@cosmjs/amino";
import { fromByteArray } from "base64-js";
import { fromBase64 } from '@cosmjs/encoding';
import type { SignerData } from "@cosmjs/stargate";
import * as core from "@shapeshiftoss/hdwallet-core";
import PLazy from "p-lazy";

import { LedgerTransport } from "..";
import { getSignature } from "./utils";
export * from "./common";
export * from "./helpers";
export * from "./hw-app-thor";

// TODO(gomes): move all below to ./thorchain

const protoTxBuilder = PLazy.from(() => import("@shapeshiftoss/proto-tx-builder"));

export const thorchainGetAddress = async (
  transport: LedgerTransport,
  msg: core.ThorchainGetAddress
): Promise<string | null> => {
  const addressAndPubkey = await transport.call(
    "Rune",
    "getAddressAndPubKey",
    msg.addressNList,
    "thor"
  );

  if ('error' in addressAndPubkey.payload) {
    throw new Error(addressAndPubkey.payload.error)
  }

  return addressAndPubkey.payload.bech32_address
};

export const thorchainSignTx = async (
  transport: LedgerTransport,
  msg: core.ThorchainSignTx
): Promise<core.ThorchainSignedTx> => {

  const addressAndPubkey = await transport.call(
    "Rune",
    "getAddressAndPubKey",
    msg.addressNList,
    "thor"
  );

  if ('error' in addressAndPubkey.payload) {
    throw new Error(addressAndPubkey.payload.error)
  }

  const address = addressAndPubkey.payload.bech32_address;
  const pubkey = addressAndPubkey.payload.compressed_pk;

  const signResponse = await transport.call(
    "Rune",
    "sign",
    msg
  );

  if ('error' in signResponse.payload) {
    throw new Error(signResponse.payload.error)
  }

  console.log({ signResponse: signResponse.payload })

  const signature = signResponse.payload.signature;

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
            value: fromByteArray(pubkey),
          },
          signature: fromBase64(getSignature(signature)).toString(),
        },
      };
    },
  };

  const signerData: SignerData = {
    sequence: Number(msg.sequence),
    accountNumber: Number(msg.account_number),
    chainId: msg.chain_id,
  };

  return (await protoTxBuilder).sign(address, msg.tx as StdTx, offlineSigner, signerData, "thor");
};
