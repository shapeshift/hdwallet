import {
  DebugLinkWallet,
  Constructor,
  DEFAULT_TIMEOUT,
 } from '@shapeshift/hdwallet-core'

import { KeepKeyTransport } from './transport'

import * as ProtoMessages from '@keepkey/device-protocol/lib/messages_pb'

 /**
  * Mixin Constructor that adds DebugLink support to a KeepKeyHDWallet
  */
export function KeepKeyDebugLinkWallet<TBase extends Constructor>(Base: TBase) {
  return class KeepKeyDebugLinkWallet extends Base implements DebugLinkWallet {
    get _supportsDebugLink(): boolean {
      return this.transport.debugLink
    }
    transport: KeepKeyTransport

    public async pressYes (): Promise<void> {
      return this.press(true)
    }

    public async pressNo (): Promise<void> {
      return this.press(false)
    }

    public async press (isYes: boolean): Promise<void> {
      let decision = new ProtoMessages.DebugLinkDecision()
      decision.setYesNo(isYes)

      await this.transport.callDebugLink(
        ProtoMessages.MessageType.MESSAGETYPE_DEBUGLINKDECISION,
        decision,
        DEFAULT_TIMEOUT,
        /*omitLock=*/false,
        /*noWait=*/true
      )
    }
  }
}
