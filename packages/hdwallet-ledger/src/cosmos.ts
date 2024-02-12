import { AccountData, AminoSignResponse, OfflineAminoSigner, StdSignDoc, StdTx } from "@cosmjs/amino";
import { Secp256k1Signature } from "@cosmjs/crypto";
import type { SignerData } from "@cosmjs/stargate";
import * as core from "@shapeshiftoss/hdwallet-core";
import { fromByteArray } from "base64-js";
import PLazy from "p-lazy";

import { LedgerTransport } from "./transport";
import { handleError, stringifyKeysInOrder } from "./utils";

const protoTxBuilder = PLazy.from(() => import("@shapeshiftoss/proto-tx-builder"));

const ATOM_CHAIN = "cosmoshub-4";

export const cosmosGetAddress = async (transport: LedgerTransport, msg: core.CosmosGetAddress): Promise<string> => {
  const bip32path = core.addressNListToBIP32(msg.addressNList);
  const res = await transport.call("Cosmos", "getAddress", bip32path, "cosmos");

  handleError(res, transport, "Unable to obtain address from device.");

  return res.payload.address;
};

export const cosmosSignTx = async (
  transport: LedgerTransport,
  msg: core.CosmosSignTx
): Promise<core.CosmosSignedTx> => {
  const bip32path = core.addressNListToBIP32(msg.addressNList);
  const getAddressResponse = await transport.call("Cosmos", "getAddress", bip32path, "cosmos");

  handleError(getAddressResponse, transport, "Unable to obtain address and public key from device.");

  const { address, publicKey } = getAddressResponse.payload;

  const unsignedTx = stringifyKeysInOrder({
    account_number: msg.account_number,
    chain_id: ATOM_CHAIN,
    fee: { amount: msg.tx.fee.amount, gas: msg.tx.fee.gas },
    memo: msg.tx.memo,
    msgs: msg.tx.msg,
    sequence: msg.sequence,
  });

  const signResponse = await transport.call("Cosmos", "sign", bip32path, unsignedTx);

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

  return (await protoTxBuilder).sign(address, msg.tx as StdTx, offlineSigner, signerData, "cosmos");
};
