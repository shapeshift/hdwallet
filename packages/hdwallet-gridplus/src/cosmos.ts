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

export async function cosmosGetAddress(client: Client, msg: core.CosmosGetAddress): Promise<string | null> {
  const pubkey = (
    await client.getAddresses({ startPath: msg.addressNList, n: 1, flag: Constants.GET_ADDR_FLAGS.SECP256K1_XPUB })
  )[0];

  if (!pubkey) throw new Error("No address returned from device");

  return createBech32Address(getCompressedPubkey(pubkey), "cosmos");
}

export async function cosmosSignTx(client: Client, msg: core.CosmosSignTx): Promise<core.CosmosSignedTx | null> {
  const address = await cosmosGetAddress(client, { addressNList: msg.addressNList });
  if (!address) throw new Error("Failed to get Cosmos address");

  const xpub = (
    await client.getAddresses({ startPath: msg.addressNList, n: 1, flag: Constants.GET_ADDR_FLAGS.SECP256K1_XPUB })
  )[0];

  if (!xpub) throw new Error("No xpub returned from device");

  const pubkey = getCompressedPubkey(xpub);

  const signer: OfflineDirectSigner = {
    getAccounts: async () => [{ address, pubkey, algo: "secp256k1" }],
    signDirect: async (signerAddress: string, signDoc: SignDoc): Promise<DirectSignResponse> => {
      if (signerAddress !== address) throw new Error("Signer address mismatch");

      const signBytes = (await cosmJsProtoSigning).makeSignBytes(signDoc);

      // Sign using GridPlus SDK general signing
      const signedResult = await client.sign({
        data: {
          payload: signBytes,
          curveType: Constants.SIGNING.CURVES.SECP256K1,
          hashType: Constants.SIGNING.HASHES.SHA256,
          encodingType: Constants.SIGNING.ENCODINGS.NONE,
          signerPath: msg.addressNList,
        },
      });

      if (!signedResult?.sig) throw new Error("No signature returned from device");

      const { r, s } = signedResult.sig;

      console.log("=== COSMOS SIGNATURE DEBUG ===");
      console.log("r type:", typeof r, "isBuffer:", Buffer.isBuffer(r));
      console.log("r value:", r);
      console.log("r length:", Buffer.isBuffer(r) ? r.length : (r as any)?.length);
      console.log("s type:", typeof s, "isBuffer:", Buffer.isBuffer(s));
      console.log("s value:", s);
      console.log("s length:", Buffer.isBuffer(s) ? s.length : (s as any)?.length);

      const rBuf = Buffer.isBuffer(r) ? r : Buffer.from(r);
      const sBuf = Buffer.isBuffer(s) ? s : Buffer.from(s);

      console.log("rBuf length:", rBuf.length);
      console.log("sBuf length:", sBuf.length);
      console.log("=== END COSMOS SIGNATURE DEBUG ===");

      const signature = Buffer.concat([rBuf, sBuf]);

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

  return (await protoTxBuilder).sign(address, msg.tx as StdTx, signer, signerData, "cosmos");
}
