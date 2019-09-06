import {
  ETHWallet,
  ETHGetAddress,
  ETHSignTx,
  ETHSignedTx,
  ETHGetAccountPath,
  ETHAccountPath,
  ETHSignMessage,
  ETHSignedMessage,
  ETHVerifyMessage,
  Constructor,
  toHexString,
  fromHexString,
  arrayify,
  Event,
  Events,
  LONG_TIMEOUT,
  base64toHEX,
  slip44ByCoin,
  BTCInputScriptType,
} from '@shapeshiftoss/hdwallet-core'

import { KeepKeyTransport } from './transport'

import * as ProtoMessages from '@keepkey/device-protocol/lib/messages_pb'
import * as ProtoExchange from '@keepkey/device-protocol/lib/exchange_pb'
import * as ProtoTypes from '@keepkey/device-protocol/lib/types_pb'

const { default: { ExchangeType } } = ProtoMessages as any

// @ts-ignore
import * as Ethereumjs from 'ethereumjs-tx'
const { default: EthereumTx } = Ethereumjs as any

import {
  toUTF8Array,
  translateInputScriptType
} from './utils'

import * as EIP55 from 'eip55'

export async function ethSupportsNetwork (chain_id: number): Promise<boolean> {
  return true
}

export async function ethSupportsSecureTransfer (): Promise<boolean> {
  return true
}

export async function ethSupportsNativeShapeShift (): Promise<boolean> {
  return true
}

export function ethGetAccountPaths (msg: ETHGetAccountPath): Array<ETHAccountPath> {
  return [{
    hardenedPath: [ 0x80000000 + 44, 0x80000000 + slip44ByCoin(msg.coin), 0x80000000 + msg.accountIdx ],
    relPath: [ 0, 0 ],
    description: "KeepKey"
  }]
}

export async function ethSignTx (transport: KeepKeyTransport, msg: ETHSignTx): Promise<ETHSignedTx> {
  return transport.lockDuring(async () => {
    const est: ProtoMessages.EthereumSignTx = new ProtoMessages.EthereumSignTx()
    est.setAddressNList(msg.addressNList)
    est.setNonce(arrayify(msg.nonce))
    est.setGasPrice(arrayify(msg.gasPrice))
    est.setGasLimit(arrayify(msg.gasLimit))
    if (msg.value.match('^0x0*$') === null) {
      est.setValue(arrayify(msg.value))
    }

    if (msg.toAddressNList) {
      est.setAddressType(ProtoTypes.OutputAddressType.SPEND)
      est.setToAddressNList(msg.toAddressNList)
    } else if (msg.exchangeType) {
      est.setAddressType(ProtoTypes.OutputAddressType.EXCHANGE)

      const signedHex = base64toHEX(msg.exchangeType.signedExchangeResponse)
      const signedExchangeOut = ProtoExchange.SignedExchangeResponse.deserializeBinary(arrayify(signedHex))
      const exchangeType = new ExchangeType()
      exchangeType.setSignedExchangeResponse(signedExchangeOut)
      exchangeType.setWithdrawalCoinName(msg.exchangeType.withdrawalCoinName) // KeepKey firmware will complain if this doesn't match signed exchange response
      exchangeType.setWithdrawalAddressNList(msg.exchangeType.withdrawalAddressNList)
      exchangeType.setWithdrawalScriptType(translateInputScriptType(
        msg.exchangeType.withdrawalScriptType || BTCInputScriptType.SpendAddress))
      exchangeType.setReturnAddressNList(msg.exchangeType.returnAddressNList)
      exchangeType.setReturnScriptType(translateInputScriptType(
        msg.exchangeType.returnScriptType || BTCInputScriptType.SpendAddress))
      est.setExchangeType(exchangeType)
    } else {
      est.setAddressType(ProtoTypes.OutputAddressType.SPEND)
    }

    if (msg.to) {
      est.setTo(arrayify(msg.to))
    }

    let dataChunk = null
    let dataRemaining = undefined

    if (msg.data) {
      dataRemaining = arrayify(msg.data)
      est.setDataLength(dataRemaining.length)
      dataChunk = dataRemaining.slice(0, 1024)
      dataRemaining = dataRemaining.slice(dataChunk.length)
      est.setDataInitialChunk(dataChunk)
    }

    if (msg.chainId !== undefined) {
      est.setChainId(msg.chainId)
    }

    let response: ProtoMessages.EthereumTxRequest
    let nextResponse = await transport.call(ProtoMessages.MessageType.MESSAGETYPE_ETHEREUMSIGNTX, est, LONG_TIMEOUT, /*omitLock=*/true)
    if (nextResponse.message_enum === ProtoMessages.MessageType.MESSAGETYPE_FAILURE) {
      throw nextResponse
    }
    response = nextResponse.proto as ProtoMessages.EthereumTxRequest

    try {
      while (response.hasDataLength()) {
        const dataLength = response.getDataLength()
        dataChunk = dataRemaining.slice(0, dataLength)
        dataRemaining = dataRemaining.slice(dataLength, dataRemaining.length)

        nextResponse = await transport.call(ProtoMessages.MessageType.MESSAGETYPE_ETHEREUMSIGNTX, est, LONG_TIMEOUT, /*omitLock=*/true)
        if (nextResponse.message_enum === ProtoMessages.MessageType.MESSAGETYPE_FAILURE) {
          throw nextResponse
        }
        response = nextResponse.proto as ProtoMessages.EthereumTxRequest
      }
    } catch(error) {
      console.error({ error })
      throw new Error('Failed to sign ETH transaction')
    }

    const r = '0x' + toHexString(response.getSignatureR_asU8())
    const s = '0x' + toHexString(response.getSignatureS_asU8())
    const v = '0x' + response.getSignatureV().toString(16)

    const utx = {
      to: msg.to,
      value: msg.value,
      data: msg.data,
      chainId: msg.chainId,
      nonce: msg.nonce,
      gasLimit: msg.gasLimit,
      gasPrice: msg.gasPrice,
      r,
      s,
      v
    }

    const tx = new EthereumTx(utx)

    return {
      r,
      s,
      v: response.getSignatureV(),
      serialized: '0x' + toHexString(tx.serialize())
    }
  })
}

export async function ethGetAddress (transport: KeepKeyTransport, msg: ETHGetAddress): Promise<string> {
  const getAddr = new ProtoMessages.EthereumGetAddress()
  getAddr.setAddressNList(msg.addressNList)
  getAddr.setShowDisplay(msg.showDisplay !== false)
  const response = await transport.call(ProtoMessages.MessageType.MESSAGETYPE_ETHEREUMGETADDRESS, getAddr, LONG_TIMEOUT)
  const ethAddress = response.proto as ProtoMessages.EthereumAddress

  if(response.message_type === Events.FAILURE) throw response

  let address = null
  if (ethAddress.hasAddressStr())
    address = ethAddress.getAddressStr()
  else if (ethAddress.hasAddress())
    address = '0x' + toHexString(ethAddress.getAddress_asU8())
  else
    throw new Error('Unable to obtain ETH address from device.')

  return address
}

export async function ethSignMessage (transport: KeepKeyTransport, msg: ETHSignMessage): Promise<ETHSignedMessage> {
  const m = new ProtoMessages.EthereumSignMessage()
  m.setAddressNList(msg.addressNList)
  m.setMessage(toUTF8Array(msg.message))
  const response = await transport.call(ProtoMessages.MessageType.MESSAGETYPE_ETHEREUMSIGNMESSAGE, m, LONG_TIMEOUT) as Event
  const sig = response.proto as ProtoMessages.EthereumMessageSignature
  return {
    address: EIP55.encode('0x' + toHexString(sig.getAddress_asU8())), // FIXME: this should be done in the firmware
    signature: '0x' + toHexString(sig.getSignature_asU8())
  }
}

export async function ethVerifyMessage (transport: KeepKeyTransport, msg: ETHVerifyMessage): Promise<boolean> {
  const m = new ProtoMessages.EthereumVerifyMessage()
  m.setAddress(arrayify(msg.address))
  m.setSignature(arrayify(msg.signature))
  m.setMessage(toUTF8Array(msg.message))
  const event = await transport.call(ProtoMessages.MessageType.MESSAGETYPE_ETHEREUMVERIFYMESSAGE, m, LONG_TIMEOUT) as Event
  const success = event.proto as ProtoMessages.Success
  return success.getMessage() === 'Message verified'
}
