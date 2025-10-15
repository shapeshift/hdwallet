import type { StdTx } from "@cosmjs/amino";
import type { DirectSignResponse, OfflineDirectSigner } from "@cosmjs/proto-signing";
import type { SignerData } from "@cosmjs/stargate";
import { pointCompress } from "@bitcoinerlab/secp256k1";
import type { SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import * as core from "@shapeshiftoss/hdwallet-core";
import * as bech32 from "bech32";
import CryptoJS from "crypto-js";
import { Client, Constants } from "gridplus-sdk";
import PLazy from "p-lazy";

const protoTxBuilder = PLazy.from(() => import("@shapeshiftoss/proto-tx-builder"));
const cosmJsProtoSigning = PLazy.from(() => import("@cosmjs/proto-signing"));

export const bech32ify = (address: ArrayLike<number>, prefix: string): string => {
  const words = bech32.toWords(address);
  return bech32.encode(prefix, words);
};

export const createCosmosAddress = (publicKey: string, prefix: string): string => {
  const message = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(publicKey));
  const hash = CryptoJS.RIPEMD160(message as CryptoJS.lib.WordArray).toString();
  const address = Buffer.from(hash, `hex`);
  return bech32ify(address, prefix);
};

export async function cosmosGetAddress(client: Client, msg: core.CosmosGetAddress): Promise<string | null> {
  try {
    // Get secp256k1 pubkey using GridPlus client instance
    // Use FULL path - Cosmos uses standard BIP44: m/44'/118'/0'/0/0 (5 levels)
    const addresses = await client.getAddresses({
      startPath: msg.addressNList,
      n: 1,
      flag: Constants.GET_ADDR_FLAGS.SECP256K1_PUB,
    });

    if (!addresses.length) {
      throw new Error("No address returned from device");
    }

    // GridPlus SDK returns uncompressed 65-byte pubkeys, but Cosmos needs compressed 33-byte pubkeys
    const pubkeyBuffer = Buffer.isBuffer(addresses[0]) ? addresses[0] : Buffer.from(addresses[0], "hex");
    const compressedPubkey = pointCompress(pubkeyBuffer, true);
    const compressedHex = Buffer.from(compressedPubkey).toString("hex");
    const cosmosAddress = createCosmosAddress(compressedHex, "cosmos");

    return cosmosAddress;
  } catch (error) {
    throw error;
  }
}

export async function cosmosSignTx(
  client: Client,
  getAddressFn: (msg: core.CosmosGetAddress) => Promise<string | null>,
  msg: core.CosmosSignTx
): Promise<core.CosmosSignedTx | null> {
  try {
    // Get the address for this path
    const address = await getAddressFn({ addressNList: msg.addressNList });
    if (!address) throw new Error("Failed to get Cosmos address");

    // Get the public key using client instance
    const pubkeys = await client.getAddresses({
      startPath: msg.addressNList,
      n: 1,
      flag: Constants.GET_ADDR_FLAGS.SECP256K1_PUB,
    });

    if (!pubkeys.length) {
      throw new Error("No public key returned from device");
    }

    // GridPlus SDK returns uncompressed 65-byte pubkeys, but Cosmos needs compressed 33-byte pubkeys
    const pubkeyBuffer = Buffer.isBuffer(pubkeys[0]) ? pubkeys[0] : Buffer.from(pubkeys[0], "hex");
    const compressedPubkey = pointCompress(pubkeyBuffer, true);
    const pubkey = Buffer.from(compressedPubkey);

    // Create a signer adapter for GridPlus with Direct signing (Proto)
    const signer: OfflineDirectSigner = {
      getAccounts: async () => [
        {
          address,
          pubkey,
          algo: "secp256k1" as const,
        },
      ],
      signDirect: async (signerAddress: string, signDoc: SignDoc): Promise<DirectSignResponse> => {
        if (signerAddress !== address) {
          throw new Error("Signer address mismatch");
        }

        // Use CosmJS to create the sign bytes from the SignDoc
        const signBytes = (await cosmJsProtoSigning).makeSignBytes(signDoc);

        // Sign using GridPlus SDK general signing
        // Pass unhashed signBytes and let device hash with SHA256
        const signData = {
          data: {
            payload: signBytes,
            curveType: Constants.SIGNING.CURVES.SECP256K1,
            hashType: Constants.SIGNING.HASHES.SHA256,
            encodingType: Constants.SIGNING.ENCODINGS.NONE,
            signerPath: msg.addressNList,
          },
        };

        const signedResult = await client.sign(signData);

        if (!signedResult?.sig) {
          throw new Error("No signature returned from device");
        }

        const { r, s } = signedResult.sig;
        const rHex = Buffer.isBuffer(r) ? r : Buffer.from(r);
        const sHex = Buffer.isBuffer(s) ? s : Buffer.from(s);

        // Combine r and s for signature
        const signature = Buffer.concat([rHex, sHex]);

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
  } catch (error) {
    throw error;
  }
}

export const cosmosGetAccountPaths = (msg: core.CosmosGetAccountPaths): Array<core.CosmosAccountPath> => {
  const slip44 = core.slip44ByCoin("Atom");
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
    },
  ];
};

export const cosmosNextAccountPath = (msg: core.CosmosAccountPath): core.CosmosAccountPath | undefined => {
  const newAddressNList = [...msg.addressNList];
  newAddressNList[2] += 1;
  return {
    addressNList: newAddressNList,
  };
};
