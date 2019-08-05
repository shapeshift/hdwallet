import {
  DebugLinkWallet,
  Constructor,
 } from '@shapeshift/hdwallet-core'

import { TrezorTransport } from './transport'

 /**
  * Mixin Constructor that adds DebugLink support to a TrezorHDWallet
  */
export function TrezorDebugLinkWallet<TBase extends Constructor>(Base: TBase) {
  return class TrezorDebugLinkWallet extends Base implements DebugLinkWallet {
    _supportsDebugLink: boolean = true
    transport: TrezorTransport

    public async pressYes (): Promise<void> {
      return this.press(true)
    }

    public async pressNo (): Promise<void> {
      return this.press(false)
    }

    public async press (isYes: boolean): Promise<void> {
      await this.transport.call('debugLinkDecision', { yes_no: isYes }) 
    }
  }
}
