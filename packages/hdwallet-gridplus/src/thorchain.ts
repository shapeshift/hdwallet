import type { StdTx } from "@cosmjs/amino";
import type { DirectSignResponse, OfflineDirectSigner } from "@cosmjs/proto-signing";
import type { SignerData } from "@cosmjs/stargate";
import * as core from "@shapeshiftoss/hdwallet-core";
import type { SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { Client, Constants } from "gridplus-sdk";
import PLazy from "p-lazy";

import { createBech32Address, getCompressedPubkey } from "./utils";

const protoTxBuilder = PLazy.from(() => import("@shapeshiftoss/proto-tx-builder"));
const cosmJsProtoSigning = PLazy.from(() => import("@cosmjs/proto-signing"));

export async function thorchainGetAddress(client: Client, msg: core.ThorchainGetAddress): Promise<string | null> {
  const xpub = (
    await client.getAddresses({ startPath: msg.addressNList, n: 1, flag: Constants.GET_ADDR_FLAGS.SECP256K1_XPUB })
  )[0];

  if (!xpub) throw new Error("No address returned from device");

  return createBech32Address(getCompressedPubkey(xpub), "thor");
}

export async function thorchainSignTx(
  client: Client,
  msg: core.ThorchainSignTx
): Promise<core.ThorchainSignedTx | null> {
  const address = await thorchainGetAddress(client, { addressNList: msg.addressNList });
  if (!address) throw new Error("Failed to get THORChain address");

  const xpub = (
    await client.getAddresses({ startPath: msg.addressNList, n: 1, flag: Constants.GET_ADDR_FLAGS.SECP256K1_XPUB })
  )[0];

  if (!xpub) throw new Error("No xpub returned from device");

  const pubkey = getCompressedPubkey(xpub);

  // Create a signer adapter for GridPlus with Direct signing (Proto)
  const signer: OfflineDirectSigner = {
    getAccounts: async () => [{ address, pubkey, algo: "secp256k1" }],
    signDirect: async (signerAddress: string, signDoc: SignDoc): Promise<DirectSignResponse> => {
      if (signerAddress !== address) throw new Error("Signer address mismatch");

      const signBytes = (await cosmJsProtoSigning).makeSignBytes(signDoc);

      // Sign using GridPlus SDK general signing
      const signData = await client.sign({
        data: {
          payload: signBytes,
          curveType: Constants.SIGNING.CURVES.SECP256K1,
          hashType: Constants.SIGNING.HASHES.SHA256,
          encodingType: Constants.SIGNING.ENCODINGS.NONE,
          signerPath: msg.addressNList,
        },
      });

      if (!signData?.sig) throw new Error("No signature returned from device");

      const { r, s } = signData.sig;

      if (!Buffer.isBuffer(r)) throw new Error("Invalid signature (r)");
      if (!Buffer.isBuffer(s)) throw new Error("Invalid signature (s)");

      const signature = Buffer.concat([r, s]);

      return {
        signed: signDoc,
        signature: {
          pub_key: {
            type: "tendermint/PubKeySecp256k1",
            value: pubkey.toString("base64"),
          },
          signature: signature.toString("base64"),
        },
      };
    },
  };

  const signerData: SignerData = {
    sequence: Number(msg.sequence),
    accountNumber: Number(msg.account_number),
    chainId: msg.chain_id,
  };

  return (await protoTxBuilder).sign(address, msg.tx as StdTx, signer, signerData, "thorchain");
}
