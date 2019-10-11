import {
  ecrecover,
  hashPersonalMessage,
  toBuffer,
  pubToAddress
} from 'ethereumjs-util'
// @ts-ignore
import * as Ethereumjs from 'ethereumjs-tx'
const { default: EthereumTx } = Ethereumjs as any
import {
  addressNListToBIP32,
  Constructor,
  ETHWallet,
  ETHGetAddress,
  ETHSignTx,
  ETHSignedTx,
  ETHGetAccountPath,
  ETHAccountPath,
  ETHSignMessage,
  ETHSignedMessage,
  ETHVerifyMessage,
  toHexString,
  stripHexPrefixAndLower,
  slip44ByCoin
} from '@shapeshiftoss/hdwallet-core'
import { handleError } from './utils'
import { LedgerTransport } from './transport'

export async function ethSupportsNetwork(chain_id: number): Promise<boolean> {
  return chain_id === 1
}

export async function ethGetAddress(transport: LedgerTransport, msg: ETHGetAddress): Promise<string> {
  const bip32path = addressNListToBIP32(msg.addressNList)
  const res = await transport.call('Eth', 'getAddress', bip32path, !!msg.showDisplay)
  handleError(transport, res, 'Unable to obtain ETH address from device.')

  return res.payload.address
}

export async function ethSignTx(transport: LedgerTransport, msg: ETHSignTx): Promise<ETHSignedTx> {
  const bip32path = addressNListToBIP32(msg.addressNList)
  const txParams = {
    to: msg.to,
    value: msg.value,
    data: msg.data,
    chainId: msg.chainId,
    nonce: msg.nonce,
    gasLimit: msg.gasLimit,
    gasPrice: msg.gasPrice,
    v: '0x' + msg.chainId.toString(16).padStart(2, '0'),
    r: '0x00',
    s: '0x00'
  }

  let utx = new EthereumTx(txParams)

  const res = await transport.call('Eth', 'signTransaction', bip32path,
    utx.serialize().toString('hex'))
  handleError(transport, res, 'Could not sign ETH tx with Ledger')

  const { v, r, s } = res.payload

  const tx = new EthereumTx({
    ...txParams,
    v: '0x' + v,
    r: '0x' + r,
    s: '0x' + s
  })

  return {
    v: parseInt(v, 16),
    r: '0x' + r,
    s: '0x' + s,
    serialized: '0x' + toHexString(tx.serialize())
  }
}

export async function ethSupportsSecureTransfer(): Promise<boolean> {
  return false
}

export async function ethSupportsNativeShapeShift(): Promise<boolean> {
  return false
}

export function ethGetAccountPaths (msg: ETHGetAccountPath): Array<ETHAccountPath> {
  return [{
    addressNList: [ 0x80000000 + 44, 0x80000000 + slip44ByCoin(msg.coin), 0x80000000 + msg.accountIdx, 0, 0 ],
    hardenedPath: [ 0x80000000 + 44, 0x80000000 + slip44ByCoin(msg.coin), 0x80000000 + msg.accountIdx ],
    relPath: [ 0, 0 ],
    description: "Ledger (Ledger Live)"
  }, {
    addressNList: [ 0x80000000 + 44, 0x80000000 + slip44ByCoin(msg.coin), 0x80000000 + 0, msg.accountIdx ],
    hardenedPath: [ 0x80000000 + 44, 0x80000000 + slip44ByCoin(msg.coin), 0x80000000 + 0 ],
    relPath: [ msg.accountIdx ],
    description: "Ledger (legacy, Ledger Chrome App)"
  }]
}

export async function ethSignMessage(transport: LedgerTransport, msg: ETHSignMessage): Promise<ETHSignedMessage> {
  const bip32path = addressNListToBIP32(msg.addressNList)
  const res = await transport.call('Eth', 'signPersonalMessage', bip32path,
    Buffer.from(msg.message).toString('hex'))
  handleError(transport, res, 'Could not sign ETH message with device')

  let { v, r, s } = res.payload
  v = v - 27
  v = v.toString(16).padStart(2, '0')
  const addressRes = await transport.call('Eth', 'getAddress', bip32path, false)
  handleError(transport, addressRes, 'Unable to obtain ETH address from device.')

  return {
    address: addressRes.payload.address,
    signature: '0x' + r + s + v
  }
}

// Adapted from https://github.com/kvhnuke/etherwallet/blob/2a5bc0db1c65906b14d8c33ce9101788c70d3774/app/scripts/controllers/signMsgCtrl.js#L118
export async function ethVerifyMessage(msg: ETHVerifyMessage): Promise<boolean> {
  const sigb = new Buffer(stripHexPrefixAndLower(msg.signature), 'hex')
  if (sigb.length !== 65) {
    return false
  }
  sigb[64] = sigb[64] === 0 || sigb[64] === 1 ? sigb[64] + 27 : sigb[64]
  const hash = hashPersonalMessage(toBuffer(msg.message))
  const pubKey = ecrecover(hash, sigb[64], sigb.slice(0, 32), sigb.slice(32, 64))

  return stripHexPrefixAndLower(msg.address) === pubToAddress(pubKey).toString('hex')
}
