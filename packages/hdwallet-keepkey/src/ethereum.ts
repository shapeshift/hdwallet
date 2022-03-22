import Common from "@ethereumjs/common";
import { FeeMarketEIP1559Transaction, Transaction } from "@ethereumjs/tx";
import * as Exchange from "@keepkey/device-protocol/lib/exchange_pb";
import * as Messages from "@keepkey/device-protocol/lib/messages_pb";
import * as Types from "@keepkey/device-protocol/lib/types_pb";
import * as core from "@shapeshiftoss/hdwallet-core";
import * as eip55 from "eip55";

import { Transport } from "./transport";
import { toUTF8Array, translateInputScriptType } from "./utils";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function ethSupportsNetwork(chainId: number): Promise<boolean> {
  return true;
}

export async function ethSupportsSecureTransfer(): Promise<boolean> {
  return true;
}

export function ethSupportsNativeShapeShift(): boolean {
  return true;
}

export function ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
  const slip44 = core.slip44ByCoin(msg.coin);
  if (slip44 === undefined) return [];
  return [
    {
      addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0, 0],
      hardenedPath: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx],
      relPath: [0, 0],
      description: "KeepKey",
    },
  ];
}

function stripLeadingZeroes(buf: Uint8Array) {
  const firstZeroIndex = buf.findIndex((x) => x !== 0);
  return buf.slice(firstZeroIndex !== -1 ? firstZeroIndex : buf.length);
}

export async function ethSignTx(transport: Transport, msg: core.ETHSignTx): Promise<core.ETHSignedTx> {
  return transport.lockDuring(async () => {
    const est: Messages.EthereumSignTx = new Messages.EthereumSignTx();
    est.setAddressNList(msg.addressNList);
    est.setNonce(stripLeadingZeroes(core.arrayify(msg.nonce)));
    est.setGasLimit(core.arrayify(msg.gasLimit));
    if (msg.gasPrice) {
      est.setGasPrice(core.arrayify(msg.gasPrice));
    }
    if (msg.maxFeePerGas) {
      est.setMaxFeePerGas(core.arrayify(msg.maxFeePerGas));
      est.setType(core.ETHTransactionType.ETH_TX_TYPE_EIP_1559);
      if (msg.maxPriorityFeePerGas) {
        est.setMaxPriorityFeePerGas(core.arrayify(msg.maxPriorityFeePerGas));
      }
    }

    if (msg.value.match("^0x0*$") === null) {
      est.setValue(core.arrayify(msg.value));
    }

    if (msg.toAddressNList) {
      est.setAddressType(Types.OutputAddressType.SPEND);
      est.setToAddressNList(msg.toAddressNList);
    } else if (msg.exchangeType) {
      est.setAddressType(Types.OutputAddressType.EXCHANGE);

      const signedHex = core.base64toHEX(msg.exchangeType.signedExchangeResponse);
      const signedExchangeOut = Exchange.SignedExchangeResponse.deserializeBinary(core.arrayify(signedHex));
      const exchangeType = new Types.ExchangeType();
      exchangeType.setSignedExchangeResponse(signedExchangeOut);
      exchangeType.setWithdrawalCoinName(msg.exchangeType.withdrawalCoinName); // KeepKey firmware will complain if this doesn't match signed exchange response
      exchangeType.setWithdrawalAddressNList(msg.exchangeType.withdrawalAddressNList);
      exchangeType.setWithdrawalScriptType(
        translateInputScriptType(msg.exchangeType.withdrawalScriptType || core.BTCInputScriptType.SpendAddress)
      );
      exchangeType.setReturnAddressNList(msg.exchangeType.returnAddressNList);
      exchangeType.setReturnScriptType(
        translateInputScriptType(msg.exchangeType.returnScriptType || core.BTCInputScriptType.SpendAddress)
      );
      est.setExchangeType(exchangeType);
    } else {
      est.setAddressType(Types.OutputAddressType.SPEND);
    }

    if (msg.to) {
      est.setTo(core.arrayify(msg.to));
    }

    let dataChunk: Uint8Array | null | undefined = null;
    let dataRemaining: Uint8Array | null | undefined = undefined;

    if (msg.data) {
      dataRemaining = core.arrayify(msg.data);
      est.setDataLength(dataRemaining.length);
      dataChunk = dataRemaining.slice(0, 1024);
      dataRemaining = dataRemaining.slice(dataChunk.length);
      est.setDataInitialChunk(dataChunk);
    }

    if (msg.chainId !== undefined) {
      est.setChainId(msg.chainId);
    }

    let response: Messages.EthereumTxRequest;
    let nextResponse = await transport.call(Messages.MessageType.MESSAGETYPE_ETHEREUMSIGNTX, est, {
      msgTimeout: core.LONG_TIMEOUT,
      omitLock: true,
    });
    response = nextResponse.proto as Messages.EthereumTxRequest;
    try {
      const esa: Messages.EthereumTxAck = new Messages.EthereumTxAck();
      while (response.hasDataLength()) {
        const dataLength = response.getDataLength();
        dataRemaining = core.mustBeDefined(dataRemaining);
        dataChunk = dataRemaining.slice(0, dataLength);
        dataRemaining = dataRemaining.slice(dataLength, dataRemaining.length);

        esa.setDataChunk(dataChunk);
        nextResponse = await transport.call(Messages.MessageType.MESSAGETYPE_ETHEREUMTXACK, esa, {
          msgTimeout: core.LONG_TIMEOUT,
          omitLock: true,
        });
        response = nextResponse.proto as Messages.EthereumTxRequest;
      }
    } catch (error) {
      console.error({ error });
      throw new Error("Failed to sign ETH transaction");
    }

    const utxBase = {
      to: msg.to,
      value: msg.value,
      data: msg.data,
      chainId: msg.chainId,
      nonce: msg.nonce,
      gasLimit: msg.gasLimit,
      maxFeePerGas: msg.maxFeePerGas,
      maxPriorityFeePerGas: msg.maxPriorityFeePerGas,
    };

    const r = "0x" + core.toHexString(response.getSignatureR_asU8());
    const s = "0x" + core.toHexString(response.getSignatureS_asU8());
    if (!response.hasSignatureV()) throw new Error("could not get v");
    const v = core.mustBeDefined(response.getSignatureV());
    const v2 = "0x" + v.toString(16);

    const common = new Common({ chain: "mainnet", hardfork: "london" });
    const tx = msg.maxFeePerGas
      ? FeeMarketEIP1559Transaction.fromTxData({
          ...utxBase,
          maxFeePerGas: msg.maxFeePerGas,
          maxPriorityFeePerGas: msg.maxPriorityFeePerGas,
          r: r,
          s: s,
          v: v2,
        })
      : Transaction.fromTxData({ ...utxBase, gasPrice: msg.gasPrice, r: r, s: s, v: v2 }, { common });

    return {
      r,
      s,
      v,
      serialized: "0x" + core.toHexString(tx.serialize()),
    };
  });
}

export async function ethGetAddress(transport: Transport, msg: core.ETHGetAddress): Promise<string> {
  const getAddr = new Messages.EthereumGetAddress();
  getAddr.setAddressNList(msg.addressNList);
  getAddr.setShowDisplay(msg.showDisplay !== false);
  const response = await transport.call(Messages.MessageType.MESSAGETYPE_ETHEREUMGETADDRESS, getAddr, {
    msgTimeout: core.LONG_TIMEOUT,
  });
  const ethAddress = response.proto as Messages.EthereumAddress;

  let address: string;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  if (ethAddress.hasAddressStr()) address = ethAddress.getAddressStr()!;
  else if (ethAddress.hasAddress()) address = "0x" + core.toHexString(ethAddress.getAddress_asU8());
  else throw new Error("Unable to obtain ETH address from device.");

  return address;
}

export async function ethSignMessage(transport: Transport, msg: core.ETHSignMessage): Promise<core.ETHSignedMessage> {
  const m = new Messages.EthereumSignMessage();
  m.setAddressNList(msg.addressNList);
  m.setMessage(toUTF8Array(msg.message));
  const response = await transport.call(Messages.MessageType.MESSAGETYPE_ETHEREUMSIGNMESSAGE, m, {
    msgTimeout: core.LONG_TIMEOUT,
  });
  const sig = response.proto as Messages.EthereumMessageSignature;
  return {
    address: eip55.encode("0x" + core.toHexString(sig.getAddress_asU8())), // FIXME: this should be done in the firmware
    signature: "0x" + core.toHexString(sig.getSignature_asU8()),
  };
}

export async function ethVerifyMessage(transport: Transport, msg: core.ETHVerifyMessage): Promise<boolean> {
  const m = new Messages.EthereumVerifyMessage();
  m.setAddress(core.arrayify(msg.address));
  m.setSignature(core.arrayify(msg.signature));
  m.setMessage(toUTF8Array(msg.message));
  let event: core.Event;
  try {
    event = await transport.call(Messages.MessageType.MESSAGETYPE_ETHEREUMVERIFYMESSAGE, m, {
      msgTimeout: core.LONG_TIMEOUT,
    });
  } catch (e) {
    if (core.isIndexable(e) && e.message_enum === Messages.MessageType.MESSAGETYPE_FAILURE) {
      return false;
    }
    throw e;
  }
  const success = event.proto as Messages.Success;
  return success.getMessage() === "Message verified";
}
