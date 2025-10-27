import { Common, Hardfork } from "@ethereumjs/common";
import { TransactionFactory, TypedTxData } from "@ethereumjs/tx";
import * as core from "@shapeshiftoss/hdwallet-core";
import { Client, Constants, Utils } from "gridplus-sdk";

export async function ethGetAddress(client: Client, msg: core.ETHGetAddress): Promise<core.Address | null> {
  const address = (await client.getAddresses({ startPath: msg.addressNList, n: 1 }))[0];

  if (!address) throw new Error("No address returned from device");
  if (typeof address !== "string") throw new Error("Invalid address");

  return address as core.Address;
}

export async function ethSignTx(client: Client, msg: core.ETHSignTx): Promise<core.ETHSignedTx> {
  const txData: TypedTxData = {
    to: msg.to,
    value: msg.value,
    data: msg.data,
    nonce: msg.nonce,
    gasLimit: msg.gasLimit,
    chainId: msg.chainId,
    ...(msg.maxFeePerGas && msg.maxPriorityFeePerGas
      ? {
          maxFeePerGas: msg.maxFeePerGas,
          maxPriorityFeePerGas: msg.maxPriorityFeePerGas,
        }
      : {
          gasPrice: msg.gasPrice,
        }),
  };

  const common = Common.custom({ chainId: msg.chainId }, { hardfork: Hardfork.London });

  const unsignedTx = TransactionFactory.fromTxData(txData, { common });
  const payload = unsignedTx.getMessageToSign();

  const fwVersion = client.getFwVersion();
  const supportsDecoderRecursion = fwVersion.major > 0 || fwVersion.minor >= 16;

  const { def } = await (() => {
    if (!msg.data) return { def: null };
    if (msg.data.startsWith("0x") && Buffer.from(msg.data.slice(2), "hex").length < 4) return { def: null };
    return Utils.fetchCalldataDecoder(msg.data, msg.to, msg.chainId, supportsDecoderRecursion);
  })();

  const signData = await client.sign({
    data: {
      payload,
      curveType: Constants.SIGNING.CURVES.SECP256K1,
      hashType: Constants.SIGNING.HASHES.KECCAK256,
      encodingType: Constants.SIGNING.ENCODINGS.EVM,
      signerPath: msg.addressNList,
      decoder: def ? Buffer.from(def) : undefined,
    },
  });

  if (!signData?.sig) throw new Error("No signature returned from device");

  const { r, s, v } = signData.sig;

  if (!Buffer.isBuffer(r)) throw new Error("Invalid signature (r)");
  if (!Buffer.isBuffer(s)) throw new Error("Invalid signature (s)");
  if (!Buffer.isBuffer(v)) throw new Error("Invalid signature (v)");

  const signedTx = TransactionFactory.fromTxData({ ...txData, r, s, v }, { common });
  const serialized = `0x${Buffer.from(signedTx.serialize()).toString("hex")}`;

  return { r: `0x${r.toString("hex")}`, s: `0x${s.toString("hex")}`, v: v.readUIntBE(0, v.length), serialized };
}

export async function ethSignTypedData(client: Client, msg: core.ETHSignTypedData): Promise<core.ETHSignedTypedData> {
  const address = await ethGetAddress(client, { addressNList: msg.addressNList });
  if (!address) throw new Error("Failed to get Ethereum address");

  const signData = await client.sign({
    currency: "ETH_MSG",
    data: {
      protocol: "eip712",
      curveType: Constants.SIGNING.CURVES.SECP256K1,
      hashType: Constants.SIGNING.HASHES.KECCAK256,
      payload: msg.typedData,
      signerPath: msg.addressNList,
    },
  });

  if (!signData?.sig) throw new Error("No signature returned from device");

  // Type assertion needed because GridPlus SDK incorrectly types ETH_MSG signatures
  const { r, s, v } = signData.sig as unknown as { r: string; s: string; v: Buffer };

  if (typeof r !== "string") throw new Error("Invalid signature (r)");
  if (typeof s !== "string") throw new Error("Invalid signature (s)");
  if (!Buffer.isBuffer(v)) throw new Error("Invalid signature (v)");

  const signature = `0x${r}${s}${v.toString("hex")}`;

  return { address, signature };
}

export async function ethSignMessage(client: Client, msg: core.ETHSignMessage): Promise<core.ETHSignedMessage> {
  const address = await ethGetAddress(client, { addressNList: msg.addressNList });
  if (!address) throw new Error("Failed to get Ethereum address");

  const signData = await client.sign({
    currency: "ETH_MSG",
    data: {
      protocol: "signPersonal",
      curveType: Constants.SIGNING.CURVES.SECP256K1,
      hashType: Constants.SIGNING.HASHES.KECCAK256,
      payload: msg.message,
      signerPath: msg.addressNList,
    },
  });

  if (!signData?.sig) throw new Error("No signature returned from device");

  // Type assertion needed because GridPlus SDK incorrectly types ETH_MSG signatures
  const { r, s, v } = signData.sig as unknown as { r: string; s: string; v: Buffer };

  if (typeof r !== "string") throw new Error("Invalid signature (r)");
  if (typeof s !== "string") throw new Error("Invalid signature (s)");
  if (!Buffer.isBuffer(v)) throw new Error("Invalid signature (v)");

  const signature = `0x${r}${s}${v.toString("hex")}`;

  return { address, signature };
}
