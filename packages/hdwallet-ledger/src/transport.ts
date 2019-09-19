import { Coin, Transport, Keyring } from '@shapeshiftoss/hdwallet-core'

export interface LedgerResponse {
  success: boolean,
  payload: any | { error: string },
  coin: Coin,
  method: string
}

export abstract class LedgerTransport extends Transport {
  hasPopup: boolean
  transport: any

  constructor(transport: any, keyring: Keyring) {
    super(keyring)
    this.transport = transport
  }

  public abstract async call(coin: string, method: string, ...args: any[]): Promise<LedgerResponse>
}
