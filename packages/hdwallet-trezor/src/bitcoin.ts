import {
  BTCWallet,
  BTCGetAddress,
  BTCSignTx,
  BTCSignedTx,
  BTCGetAccountPaths,
  BTCAccountPath,
  BTCSignMessage,
  BTCSignedMessage,
  BTCVerifyMessage,
  BTCInputScriptType,
  Constructor,
  Coin,
  BTCOutputScriptType,
  BTCOutputAddressType,
  toHexString,
  fromHexString,
  slip44ByCoin,
  addressNListToBIP32,
} from "@shapeshiftoss/hdwallet-core";

import { handleError } from "./utils";
import { TrezorTransport } from "./transport";

import Base64 from "base64-js";

function translateCoin(coin: Coin): string {
  return {
    Bitcoin: "btc",
    Litecoin: "ltc",
    Zcash: "zec",
    BitcoinCash: "bch",
    BitcoinGold: "btg",
    Dash: "dash",
    DigiByte: "dgb",
    Testnet: "testnet",
    Dogecoin: "doge",
  }[coin];
}

const segwitCoins = ["Bitcoin", "Litecoin", "BitcoinGold", "Testnet"];

function translateInputScriptType(scriptType: BTCInputScriptType): string {
  switch (scriptType) {
    case BTCInputScriptType.SpendAddress:
      return "SPENDADDRESS";
    case BTCInputScriptType.SpendMultisig:
      return "SPENDMULTISIG";
    case BTCInputScriptType.SpendWitness:
      return "SPENDWITNESS";
    case BTCInputScriptType.SpendP2SHWitness:
      return "SPENDP2SHWITNESS";
  }
  throw new Error(`Un-handled enum entry: '${scriptType}'`);
}

function translateOutputScriptType(scriptType: BTCOutputScriptType): string {
  switch (scriptType) {
    case BTCOutputScriptType.PayToAddress:
      return "PAYTOADDRESS";
    case BTCOutputScriptType.PayToMultisig:
      return "PAYTOMULTISIG";
    case BTCOutputScriptType.PayToWitness:
      return "PAYTOWITNESS";
    case BTCOutputScriptType.PayToP2SHWitness:
      return "PAYTOP2SHWITNESS";
  }
  throw new Error(`Un-handled enum entry: '${scriptType}'`);
}

export async function btcSupportsCoin(coin: Coin): Promise<boolean> {
  return translateCoin(coin) !== undefined;
}

export async function btcSupportsScriptType(coin: Coin, scriptType: BTCInputScriptType): Promise<boolean> {
  if (translateCoin(coin) === undefined) return false;
  if (!segwitCoins.includes(coin) && scriptType === BTCInputScriptType.SpendP2SHWitness) return false;
  if (!segwitCoins.includes(coin) && scriptType === BTCInputScriptType.SpendWitness) return false;
  return true;
}

export async function btcGetAddress(transport: TrezorTransport, msg: BTCGetAddress): Promise<string> {
  console.assert(
    !msg.showDisplay || !!msg.address,
    "HDWalletTrezor::btcGetAddress: expected address is required for showDisplay"
  );
  let args: any = {
    path: addressNListToBIP32(msg.addressNList),
    showOnTrezor: msg.showDisplay !== false,
    coin: translateCoin(msg.coin),
  };
  if (msg.address) args.address = msg.address;
  // TODO: TrezorConnect doesn't support setting scriptType on getAddress
  let res = await transport.call("getAddress", args);

  handleError(transport, res, "Could not get address from Trezor");

  return res.payload.address;
}

export async function btcSignTx(wallet: BTCWallet, transport: TrezorTransport, msg: BTCSignTx): Promise<BTCSignedTx> {
  let supportsShapeShift = wallet.btcSupportsNativeShapeShift();
  let supportsSecureTransfer = await wallet.btcSupportsSecureTransfer();

  let inputs = msg.inputs.map((input) => {
    return {
      address_n: input.addressNList,
      prev_hash: input.txid,
      prev_index: input.vout,
      amount: input.amount,
      script_type: translateInputScriptType(input.scriptType),
    };
  });

  let outputs = msg.outputs.map((output) => {
    if (output.exchangeType && !supportsShapeShift) throw new Error("Trezor does not support Native ShapeShift");

    if (output.addressNList) {
      if (output.addressType === BTCOutputAddressType.Transfer && !supportsSecureTransfer)
        throw new Error("Trezor does not support SecureTransfer");

      return {
        address_n: output.addressNList,
        amount: output.amount,
        script_type: translateOutputScriptType(output.scriptType),
      };
    } else if (output.addressType == BTCOutputAddressType.Transfer) {
      throw new Error("invalid arguments");
    }

    if (output.address) {
      return {
        address: output.address,
        amount: output.amount,
        script_type: "PAYTOADDRESS",
      };
    }

    throw new Error("invalid arguments");
  });

  if (msg.opReturnData) {
    if (msg.opReturnData.length > 80) {
      throw new Error("OP_RETURN data must be less than 80 chars.");
    }
    outputs.push({
      amount: "0",
      op_return_data: Buffer.from(msg.opReturnData),
      script_type: "3", // Trezor firmware uses enumerated type with value of 3 for "PAYTOOPRETURN"
    });
  }

  let res = await transport.call("signTransaction", {
    coin: translateCoin(msg.coin),
    inputs: inputs,
    outputs: outputs,
    push: false,
  });

  handleError(transport, res, "Could not sign transaction with Trezor");

  return {
    signatures: res.payload.signatures,
    serializedTx: res.payload.serializedTx,
  };
}

export async function btcSupportsSecureTransfer(): Promise<boolean> {
  return false;
}

export function btcSupportsNativeShapeShift(): boolean {
  return false;
}

export async function btcSignMessage(transport: TrezorTransport, msg: BTCSignMessage): Promise<BTCSignedMessage> {
  let res = await transport.call("signMessage", {
    path: msg.addressNList,
    message: msg.message,
    coin: translateCoin(msg.coin),
  });

  handleError(transport, res, "Could not sign message with Trezor");

  return {
    address: res.payload.address,
    signature: toHexString(Uint8Array.from(Base64.toByteArray(res.payload.signature))),
  };
}

export async function btcVerifyMessage(transport: TrezorTransport, msg: BTCVerifyMessage): Promise<boolean> {
  let res = await transport.call("verifyMessage", {
    address: msg.address,
    message: msg.message,
    signature: Base64.fromByteArray(fromHexString(msg.signature)),
    coin: translateCoin(msg.coin),
  });

  if (!res.success && res.payload.error === "Invalid signature") return false;

  handleError(transport, res, "Could not verify message with Trezor");

  return res.payload.message === "Message verified";
}

export function btcGetAccountPaths(msg: BTCGetAccountPaths): Array<BTCAccountPath> {
  const slip44 = slip44ByCoin(msg.coin);
  const bip44 = {
    coin: msg.coin,
    scriptType: BTCInputScriptType.SpendAddress,
    addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx],
  };
  const bip49 = {
    coin: msg.coin,
    scriptType: BTCInputScriptType.SpendP2SHWitness,
    addressNList: [0x80000000 + 49, 0x80000000 + slip44, 0x80000000 + msg.accountIdx],
  };
  const bip84 = {
    coin: msg.coin,
    scriptType: BTCInputScriptType.SpendWitness,
    addressNList: [0x80000000 + 84, 0x80000000 + slip44, 0x80000000 + msg.accountIdx],
  };

  let paths: Array<BTCAccountPath>;

  if (segwitCoins.includes(msg.coin)) paths = [bip49, bip44, bip84];
  else paths = [bip44];

  if (msg.scriptType !== undefined)
    paths = paths.filter((path) => {
      return path.scriptType === msg.scriptType;
    });

  return paths;
}

export function btcIsSameAccount(msg: Array<BTCAccountPath>): boolean {
  // Trezor does not support mixed-mode segwit, and only lets you spend from
  // a single account (otherwise change is represented as an output).
  return msg.length == 1;
}
