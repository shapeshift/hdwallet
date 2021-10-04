import * as core from "@shapeshiftoss/hdwallet-core";
import Base64 from "base64-js";

import { handleError } from "./utils";
import { TrezorTransport } from "./transport";

type BTCTrezorSignTxOutput = {
  amount?: string;
  address?: string;
  address_n?: core.BIP32Path | string;
  script_type?: string;
  op_return_data?: Buffer;
};

function translateCoin(coin: core.Coin): string {
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

function translateInputScriptType(scriptType?: core.BTCInputScriptType): string {
  switch (scriptType) {
    case core.BTCInputScriptType.SpendAddress:
      return "SPENDADDRESS";
    case core.BTCInputScriptType.SpendMultisig:
      return "SPENDMULTISIG";
    case core.BTCInputScriptType.SpendWitness:
      return "SPENDWITNESS";
    case core.BTCInputScriptType.SpendP2SHWitness:
      return "SPENDP2SHWITNESS";
  }
  throw new Error(`Un-handled enum entry: '${scriptType}'`);
}

function translateOutputScriptType(scriptType?: core.BTCOutputScriptType): string {
  switch (scriptType) {
    case core.BTCOutputScriptType.PayToAddress:
      return "PAYTOADDRESS";
    case core.BTCOutputScriptType.PayToMultisig:
      return "PAYTOMULTISIG";
    case core.BTCOutputScriptType.PayToWitness:
      return "PAYTOWITNESS";
    case core.BTCOutputScriptType.PayToP2SHWitness:
      return "PAYTOP2SHWITNESS";
  }
  throw new Error(`Un-handled enum entry: '${scriptType}'`);
}

export async function btcSupportsCoin(coin: core.Coin): Promise<boolean> {
  return translateCoin(coin) !== undefined;
}

export async function btcSupportsScriptType(coin: core.Coin, scriptType?: core.BTCInputScriptType): Promise<boolean> {
  if (translateCoin(coin) === undefined) return false;
  if (!segwitCoins.includes(coin) && scriptType === core.BTCInputScriptType.SpendP2SHWitness) return false;
  if (!segwitCoins.includes(coin) && scriptType === core.BTCInputScriptType.SpendWitness) return false;
  return true;
}

export async function btcGetAddress(transport: TrezorTransport, msg: core.BTCGetAddress): Promise<string> {
  let args: any = {
    path: core.addressNListToBIP32(msg.addressNList),
    showOnTrezor: !!msg.showDisplay,
    coin: translateCoin(msg.coin),
  };
  if (msg.showDisplay) {
    args.address = await btcGetAddress(transport, {
      ...msg,
      showDisplay: false,
    });
  }

  // TODO: TrezorConnect doesn't support setting scriptType on getAddress
  let res = await transport.call("getAddress", args);

  handleError(transport, res, "Could not get address from Trezor");

  return res.payload.address;
}

export async function btcSignTx(wallet: core.BTCWallet, transport: TrezorTransport, msg: core.BTCSignTxTrezor): Promise<core.BTCSignedTx> {
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

  let outputs: BTCTrezorSignTxOutput[] = msg.outputs.map((output) => {
    if (output.exchangeType && !supportsShapeShift) throw new Error("Trezor does not support Native ShapeShift");

    if (output.addressNList) {
      if (output.addressType === core.BTCOutputAddressType.Transfer && !supportsSecureTransfer)
        throw new Error("Trezor does not support SecureTransfer");

      return {
        address_n: output.addressNList,
        amount: output.amount,
        script_type: translateOutputScriptType(output.scriptType),
      };
    } else if (output.addressType as core.BTCOutputAddressType == core.BTCOutputAddressType.Transfer) {
      throw new Error("invalid arguments");
    }

    if (output.address) {
      return {
        address: output.address,
        amount: output.amount,
        script_type: translateOutputScriptType(core.BTCOutputScriptType.PayToAddress)
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

export async function btcSignMessage(transport: TrezorTransport, msg: core.BTCSignMessage): Promise<core.BTCSignedMessage> {
  let res = await transport.call("signMessage", {
    path: msg.addressNList,
    message: msg.message,
    coin: msg.coin ? translateCoin(msg.coin) : undefined,
  });

  handleError(transport, res, "Could not sign message with Trezor");

  return {
    address: res.payload.address,
    signature: core.toHexString(Uint8Array.from(Base64.toByteArray(res.payload.signature))),
  };
}

export async function btcVerifyMessage(transport: TrezorTransport, msg: core.BTCVerifyMessage): Promise<boolean> {
  let res = await transport.call("verifyMessage", {
    address: msg.address,
    message: msg.message,
    signature: Base64.fromByteArray(core.fromHexString(msg.signature)),
    coin: translateCoin(msg.coin),
  });

  if (!res.success && res.payload.error === "Invalid signature") return false;

  handleError(transport, res, "Could not verify message with Trezor");

  return res.payload.message === "Message verified";
}

export function btcGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
  const slip44 = core.slip44ByCoin(msg.coin);
  if (slip44 === undefined) return [];
  const bip44 = {
    coin: msg.coin,
    scriptType: core.BTCInputScriptType.SpendAddress,
    addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx],
  };
  const bip49 = {
    coin: msg.coin,
    scriptType: core.BTCInputScriptType.SpendP2SHWitness,
    addressNList: [0x80000000 + 49, 0x80000000 + slip44, 0x80000000 + msg.accountIdx],
  };
  const bip84 = {
    coin: msg.coin,
    scriptType: core.BTCInputScriptType.SpendWitness,
    addressNList: [0x80000000 + 84, 0x80000000 + slip44, 0x80000000 + msg.accountIdx],
  };

  let paths: Array<core.BTCAccountPath>;

  if (segwitCoins.includes(msg.coin)) paths = [bip49, bip44, bip84];
  else paths = [bip44];

  if (msg.scriptType !== undefined)
    paths = paths.filter((path) => {
      return path.scriptType === msg.scriptType;
    });

  return paths;
}

export function btcIsSameAccount(msg: Array<core.BTCAccountPath>): boolean {
  // Trezor does not support mixed-mode segwit, and only lets you spend from
  // a single account (otherwise change is represented as an output).
  return msg.length == 1;
}
