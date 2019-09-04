import {
  DebugLinkWallet,
  Constructor,
  DEFAULT_TIMEOUT,
} from '@shapeshiftoss/hdwallet-core'

import { KeepKeyTransport } from './transport'

import * as ProtoMessages from '@keepkey/device-protocol/lib/messages_pb'

export class KeepKeyDebugLinkWallet {
    _supportsDebugLink: boolean
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
