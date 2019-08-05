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
import { LedgerTransport } from './transport'

/**
 * Mixin Constructor that adds ETH support to a LedgerHDWallet
 */
export function LedgerETHWallet<TBase extends Constructor>(Base: TBase) {
  return class LedgerETHWallet extends Base implements ETHWallet {
    _supportsETH: boolean = true
    transport: LedgerTransport

    handleError: (response: any, message: string) => void

    public async ethSupportsNetwork(chain_id: number): Promise<boolean> {
      return chain_id === 1
    }

    public async ethGetAddress(msg: ETHGetAddress): Promise<string> {
      const bip32path = addressNListToBIP32(msg.addressNList)
      const res = await this.transport.call('Eth', 'getAddress', bip32path, !!msg.showDisplay)
      this.handleError(res, 'Unable to obtain ETH address from device.')

      return res.payload.address
    }

    public async ethSignTx(msg: ETHSignTx): Promise<ETHSignedTx> {
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

      const res = await this.transport.call('Eth', 'signTransaction', bip32path,
        utx.serialize().toString('hex'))
      this.handleError(res, 'Could not sign ETH tx with Ledger')

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

    public async ethSupportsSecureTransfer(): Promise<boolean> {
      return false
   }

    public async ethSupportsNativeShapeShift(): Promise<boolean> {
      return false
    }

    public ethGetAccountPaths (msg: ETHGetAccountPath): Array<ETHAccountPath> {
      return [{
        hardenedPath: [ 0x80000000 + 44, 0x80000000 + slip44ByCoin(msg.coin), 0x80000000 + msg.accountIdx ],
        relPath: [ 0, 0 ],
        description: "Ledger (Ledger Live)"
      }, {
        hardenedPath: [ 0x80000000 + 44, 0x80000000 + slip44ByCoin(msg.coin), 0x80000000 + 0 ],
        relPath: [ msg.accountIdx ],
        description: "Ledger (legacy, Ledger Chrome App)"
      }]
    }

    public async ethSignMessage(msg: ETHSignMessage): Promise<ETHSignedMessage> {
      const bip32path = addressNListToBIP32(msg.addressNList)
      const res = await this.transport.call('Eth', 'signPersonalMessage', bip32path,
        Buffer.from(msg.message).toString('hex'))
      this.handleError(res, 'Could not sign ETH message with device')

      let { v, r, s } = res.payload
      v = v - 27
      v = v.toString(16).padStart(2, '0')
      const addressRes = await this.transport.call('Eth', 'getAddress', bip32path, false)
      this.handleError(addressRes, 'Unable to obtain ETH address from device.')

      return {
        address: addressRes.payload.address,
        signature: '0x' + r + s + v
      }
    }

    // Adapted from https://github.com/kvhnuke/etherwallet/blob/2a5bc0db1c65906b14d8c33ce9101788c70d3774/app/scripts/controllers/signMsgCtrl.js#L118
    public async ethVerifyMessage(msg: ETHVerifyMessage): Promise<boolean> {
      const sigb = new Buffer(stripHexPrefixAndLower(msg.signature), 'hex')
      if (sigb.length !== 65) {
        return false
      }
      sigb[64] = sigb[64] === 0 || sigb[64] === 1 ? sigb[64] + 27 : sigb[64]
      const hash = hashPersonalMessage(toBuffer(msg.message))
      const pubKey = ecrecover(hash, sigb[64], sigb.slice(0, 32), sigb.slice(32, 64))

      return stripHexPrefixAndLower(msg.address) === pubToAddress(pubKey).toString('hex')
    }
  }
}
