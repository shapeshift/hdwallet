import {
  DebugLinkWallet,
  Constructor,
 } from '@shapeshiftoss/hdwallet-core'

import { TrezorTransport } from './transport'

export class TrezorDebugLinkWallet {
    _supportsDebugLink: boolean
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
