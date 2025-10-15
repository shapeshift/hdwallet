import Common from "@ethereumjs/common";
import { FeeMarketEIP1559Transaction, Transaction } from "@ethereumjs/tx";
import * as core from "@shapeshiftoss/hdwallet-core";
import { Client, Constants, Utils } from "gridplus-sdk";
import { encode } from "rlp";

export const ethSupportsNetwork = (_chainId: number): boolean => true;

export const ethGetAccountPaths = (msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> => {
  const slip44 = core.slip44ByCoin(msg.coin);

  if (slip44 === undefined) {
    return [];
  }

  const addressNList = [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0];
  const hardenedPath = [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx];
  return [
    {
      addressNList,
      hardenedPath,
      relPath: [0, 0],
      description: `GridPlus-${msg.coin}-${msg.accountIdx}`,
    },
  ];
};

export const ethNextAccountPath = (msg: core.ETHAccountPath): core.ETHAccountPath | undefined => {
  const addressNList = msg.hardenedPath.concat(msg.relPath);
  const description = core.describeETHPath(addressNList);
  if (!description.isKnown || description.accountIdx === undefined) {
    return undefined;
  }

  const newAddressNList = [...addressNList];
  newAddressNList[2] += 1;

  return {
    addressNList: newAddressNList,
    hardenedPath: [newAddressNList[0], newAddressNList[1], newAddressNList[2]],
    relPath: [0, 0],
    description: "GridPlus",
  };
};

export async function ethSignTx(client: Client, msg: core.ETHSignTx): Promise<core.ETHSignedTx> {
  const unsignedTxBase = {
    to: msg.to,
    value: msg.value,
    data: msg.data,
    nonce: msg.nonce,
    gasLimit: msg.gasLimit,
    chainId: msg.chainId,
  };

  const common = msg.maxFeePerGas
    ? Common.custom({ chainId: msg.chainId }, { hardfork: "london" })
    : Common.custom({ chainId: msg.chainId });
  const unsignedTx = msg.maxFeePerGas
    ? FeeMarketEIP1559Transaction.fromTxData(
        {
          ...unsignedTxBase,
          maxFeePerGas: msg.maxFeePerGas,
          maxPriorityFeePerGas: msg.maxPriorityFeePerGas,
        },
        { common }
      )
    : Transaction.fromTxData({ ...unsignedTxBase, gasPrice: msg.gasPrice }, { common });

  const payload = msg.maxFeePerGas ? unsignedTx.getMessageToSign(false) : encode(unsignedTx.getMessageToSign(false));

  const callDataDecoder = msg.to ? await Utils.fetchCalldataDecoder(msg.data, msg.to, msg.chainId) : undefined;

  const signingData = {
    data: {
      payload,
      curveType: Constants.SIGNING.CURVES.SECP256K1,
      hashType: Constants.SIGNING.HASHES.KECCAK256,
      encodingType: Constants.SIGNING.ENCODINGS.EVM,
      signerPath: msg.addressNList,
      decoder: callDataDecoder?.def,
    },
  };

  const signedResult = await client.sign(signingData);

  if (!signedResult?.sig) {
    throw new Error("No signature returned from device");
  }

  const { r, s, v } = signedResult.sig;

  const rHex = "0x" + (Buffer.isBuffer(r) ? r.toString("hex") : core.toHexString(r));
  const sHex = "0x" + (Buffer.isBuffer(s) ? s.toString("hex") : core.toHexString(s));
  const vHex = "0x" + (Buffer.isBuffer(v) ? v.toString("hex") : core.toHexString(v));

  const signedTx = msg.maxFeePerGas
    ? FeeMarketEIP1559Transaction.fromTxData(
        {
          ...unsignedTxBase,
          maxFeePerGas: msg.maxFeePerGas,
          maxPriorityFeePerGas: msg.maxPriorityFeePerGas,
          r: rHex,
          s: sHex,
          v: vHex,
        },
        { common }
      )
    : Transaction.fromTxData(
        {
          ...unsignedTxBase,
          gasPrice: msg.gasPrice,
          r: rHex,
          s: sHex,
          v: vHex,
        },
        { common }
      );

  const finalSerializedTx = `0x${signedTx.serialize().toString("hex")}`;
  const vRaw = Buffer.isBuffer(v) ? v.readUInt8(0) : v;

  const result = {
    r: rHex,
    s: sHex,
    v: vRaw,
    serialized: finalSerializedTx,
  };

  return result;
}

export async function ethSignTypedData(
  client: Client,
  addressGetter: (msg: core.ETHGetAddress) => Promise<core.Address | null>,
  msg: core.ETHSignTypedData
): Promise<core.ETHSignedTypedData> {
  const fwConstants = client.getFwConstants();
  if (!fwConstants.eip712Supported) {
    throw new Error("EIP-712 signing not supported by firmware version");
  }

  const addressResult = await addressGetter({
    addressNList: msg.addressNList,
    showDisplay: false,
  });

  const signingOptions = {
    currency: "ETH_MSG",
    data: {
      protocol: "eip712",
      payload: msg.typedData,
      signerPath: msg.addressNList,
    },
  };

  // GridPlus SDK types don't properly support ETH_MSG currency, but runtime does
  const signedResult = await client.sign(signingOptions as Parameters<typeof client.sign>[0]);

  if (!signedResult?.sig) {
    throw new Error("No signature returned from device");
  }

  // Type assertion needed because GridPlus SDK incorrectly types ETH_MSG signatures
  const { r, s, v } = signedResult.sig as { r: string | Buffer; s: string | Buffer; v: number | Buffer };

  let rHex: string;
  let sHex: string;

  if (Buffer.isBuffer(r)) {
    rHex = "0x" + r.toString("hex");
  } else if (typeof r === "string") {
    if (r.startsWith("0x")) {
      rHex = r;
    } else {
      rHex = "0x" + r;
    }
  } else {
    throw new Error(`Unexpected r format: ${typeof r}`);
  }

  if (Buffer.isBuffer(s)) {
    sHex = "0x" + s.toString("hex");
  } else if (typeof s === "string") {
    if (s.startsWith("0x")) {
      sHex = s;
    } else {
      sHex = "0x" + s;
    }
  } else {
    throw new Error(`Unexpected s format: ${typeof s}`);
  }

  const vBuf = Buffer.isBuffer(v) ? v : typeof v === "number" ? Buffer.from([v]) : Buffer.from(v);
  const vValue = vBuf.readUInt8(0);
  const vHex = "0x" + vValue.toString(16);

  const signature = rHex + sHex.slice(2) + vHex.slice(2);

  return {
    address: addressResult!,
    signature: signature,
  };
}

export async function ethSignMessage(
  client: Client,
  addressGetter: (msg: core.ETHGetAddress) => Promise<core.Address | null>,
  msg: core.ETHSignMessage
): Promise<core.ETHSignedMessage> {
  if (typeof client.sign !== "function") {
    throw new Error("GridPlus client missing required sign method");
  }

  const addressResult = await addressGetter({
    addressNList: msg.addressNList,
    showDisplay: false,
  });

  let hexMessage: string;
  if (msg.message.startsWith("0x")) {
    hexMessage = msg.message;
  } else {
    const buffer = Buffer.from(msg.message, "utf8");
    hexMessage = "0x" + buffer.toString("hex");
  }

  const signingOptions = {
    currency: "ETH_MSG",
    data: {
      protocol: "signPersonal",
      payload: hexMessage,
      signerPath: msg.addressNList,
    },
  };

  // GridPlus SDK types don't properly support ETH_MSG currency, but runtime does
  const signedResult = await client.sign(signingOptions as Parameters<typeof client.sign>[0]);

  if (!signedResult?.sig) {
    throw new Error("No signature returned from device");
  }

  // Type assertion needed because GridPlus SDK incorrectly types ETH_MSG signatures
  const { r, s, v } = signedResult.sig as { r: string | Buffer; s: string | Buffer; v: number | Buffer };

  let rHex: string;
  let sHex: string;

  if (Buffer.isBuffer(r)) {
    rHex = "0x" + r.toString("hex");
  } else if (typeof r === "string") {
    if (r.startsWith("0x")) {
      rHex = r;
    } else {
      rHex = "0x" + r;
    }
  } else {
    throw new Error(`Unexpected r format: ${typeof r}`);
  }

  if (Buffer.isBuffer(s)) {
    sHex = "0x" + s.toString("hex");
  } else if (typeof s === "string") {
    if (s.startsWith("0x")) {
      sHex = s;
    } else {
      sHex = "0x" + s;
    }
  } else {
    throw new Error(`Unexpected s format: ${typeof s}`);
  }

  const vBuf = Buffer.isBuffer(v) ? v : typeof v === "number" ? Buffer.from([v]) : Buffer.from(v);
  const vValue = vBuf.readUInt8(0);
  const vHex = "0x" + vValue.toString(16);

  const signature = rHex + sHex.slice(2) + vHex.slice(2);

  return {
    address: addressResult!,
    signature: signature,
  };
}

export const ethVerifyMessage = (_msg: core.ETHVerifyMessage): boolean => {
  throw new Error("GridPlus ethVerifyMessage not implemented yet");
};

export const ethSupportsSecureTransfer = (): boolean => false;

export const ethSupportsNativeShapeShift = (): boolean => false;

export const ethSupportsEIP1559 = (): boolean => true;

export async function ethGetAddress(client: Client, msg: core.ETHGetAddress): Promise<core.Address | null> {
  // Extract address index from EVM path: m/44'/60'/0'/0/X
  // addressNList = [44', 60', 0', 0, X]
  const addressIndex = msg.addressNList[4] || 0;
  const startPath = [...msg.addressNList.slice(0, 4), addressIndex];

  // Fetch only the requested address using client instance
  const addresses = await client.getAddresses({
    startPath,
    n: 1,
  });

  if (!addresses.length) {
    throw new Error("No address returned from device");
  }

  const rawAddress = addresses[0];
  let address: string;

  // Handle response format (could be Buffer or string)
  if (Buffer.isBuffer(rawAddress)) {
    // Device returns raw address bytes without 0x prefix - add it for EVM compatibility
    address = "0x" + rawAddress.toString("hex");
  } else {
    address = rawAddress.toString();
  }

  // Device may return address without 0x prefix - ensure it's present for EVM compatibility
  if (!address.startsWith("0x")) {
    address = "0x" + address;
  }

  // Validate Ethereum address format (should be 42 chars with 0x prefix)
  if (address.length !== 42) {
    throw new Error(`Invalid Ethereum address length: ${address}`);
  }

  // core.Address for ETH is just a string type `0x${string}`
  return address.toLowerCase() as core.Address;
}
