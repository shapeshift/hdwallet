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
  slip44ByCoin,
  stripHexPrefix,
  addressNListToBIP32,
 } from '@shapeshiftoss/hdwallet-core'

import { TrezorTransport } from './transport'

// @ts-ignore
import * as Ethereumjs from 'ethereumjs-tx'
const { default: EthereumTx } = Ethereumjs as any

export class TrezorETHWallet {
  _supportsETH: boolean
  transport: TrezorTransport

  /**
   * There isn't (AFAICT) a clean way to tell typescript that TBase derives
   * from (or is) TrezorHDWallet, so we'll just pretend this is there, and
   * know that it'll work out at runtime.
   */
  protected handleError: (response: any, message: string) => void

  public async ethSupportsNetwork (chain_id: number): Promise<boolean> {
    return true
  }

  public async ethGetAddress (msg: ETHGetAddress): Promise<string> {
    console.assert(!msg.showDisplay || !!msg.address,
      "HDWalletTrezor::ethGetAddress: expected address is required for showDisplay")
    let args: any = {
      path: addressNListToBIP32(msg.addressNList),
      showOnTrezor: msg.showDisplay !== false,
    }
    if (msg.address)
      args.address = msg.address
    let res = await this.transport.call('ethereumGetAddress', args)
    this.handleError(res, "Could not get ETH address from Trezor")
    return res.payload.address
  }

  public async ethSignTx (msg: ETHSignTx): Promise<ETHSignedTx> {
    if (msg.toAddressNList !== undefined && !await this.ethSupportsSecureTransfer())
      throw new Error("Trezor does not support SecureTransfer")

    if (msg.exchangeType !== undefined && !await this.ethSupportsNativeShapeShift())
      throw new Error("Trezor does not support Native ShapeShift")

    const utx = {
      to: msg.to,
      value: msg.value,
      data: msg.data,
      chainId: msg.chainId,
      nonce: msg.nonce,
      gasLimit: msg.gasLimit,
      gasPrice: msg.gasPrice
    }

    let res = await this.transport.call('ethereumSignTransaction', {
      path: msg.addressNList,
      transaction: utx
    })

    this.handleError(res, "Could not sign ETH transaction with Trezor")

    const tx = new EthereumTx(utx)
    tx.v = res.payload.v
    tx.r = res.payload.r
    tx.s = res.payload.s

    return {
      v: parseInt(res.payload.v),
      r: res.payload.r,
      s: res.payload.s,
      serialized: '0x' + toHexString(tx.serialize())
    }
  }

  public async ethSignMessage (msg: ETHSignMessage): Promise<ETHSignedMessage> {
    let res = await this.transport.call('ethereumSignMessage', {
      path: msg.addressNList,
      message: msg.message
    })
    this.handleError(res, "Could not sign ETH message with Trezor")
    return {
      address: res.payload.address,
      signature: '0x' + res.payload.signature
    }
  }

  public async ethVerifyMessage (msg: ETHVerifyMessage): Promise<boolean> {
    let res = await this.transport.call('ethereumVerifyMessage', {
      address: msg.address,
      message: msg.message,
      signature: stripHexPrefix(msg.signature)
    })
    this.handleError(res, "Could not verify ETH message with Trezor")
    return res.payload.message === "Message verified"
  }

  public async ethSupportsSecureTransfer (): Promise<boolean> {
    return false
  }

  public async ethSupportsNativeShapeShift (): Promise<boolean> {
    return false
  }

  public ethGetAccountPaths (msg: ETHGetAccountPath): Array<ETHAccountPath> {
    return [{
      hardenedPath: [ 0x80000000 + 44, 0x80000000 + slip44ByCoin(msg.coin), 0x80000000 + 0 ],
      relPath: [ 0, msg.accountIdx ],
      description: "Trezor"
    }]
  }
}
