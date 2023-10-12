import type { AccountData, AminoSignResponse, OfflineAminoSigner, StdSignDoc, StdTx } from "@cosmjs/amino";
import type { SignerData } from "@cosmjs/stargate";
import * as core from "@shapeshiftoss/hdwallet-core";
import { fromByteArray } from "base64-js";
import PLazy from "p-lazy";

import { handleError, LedgerTransport } from "..";
import { getSignature } from "./utils";
export * from "./common";
export * from "./helpers";
export * from "./hw-app-thor";

// TODO(gomes): move all below to ./thorchain

const protoTxBuilder = PLazy.from(() => import("@shapeshiftoss/proto-tx-builder"));

export const thorchainGetAddress = async (
  transport: LedgerTransport,
  msg: core.ThorchainGetAddress
): Promise<string> => {
  const addressAndPubkey = await transport.call("Rune", "getAddressAndPubKey", msg.addressNList, "thor");

  handleError(addressAndPubkey, transport, "Unable to obtain address and public key from device.");

  return addressAndPubkey.payload.bech32_address;
};

export const thorchainSignTx = async (
  transport: LedgerTransport,
  msg: core.ThorchainSignTx
): Promise<core.ThorchainSignedTx> => {
  const addressAndPubkey = await transport.call("Rune", "getAddressAndPubKey", msg.addressNList, "thor");

  handleError(addressAndPubkey, transport, "Unable to obtain address and public key from device.");

  const { bech32_address: address, compressed_pk } = addressAndPubkey.payload;
  const pubkey = fromByteArray(compressed_pk);

  const signResponse = await transport.call("Rune", "sign", msg);

  handleError(signResponse, transport, "Unable to obtain signature from device.");

  const signature = signResponse.payload.signature;

  const offlineSigner: OfflineAminoSigner = {
    async getAccounts(): Promise<readonly AccountData[]> {
      return [
        {
          address,
          algo: "secp256k1",
          pubkey: compressed_pk,
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
            value: pubkey,
          },
          signature: getSignature(signature),
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
