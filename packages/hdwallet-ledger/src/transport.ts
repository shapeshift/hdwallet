import { Coin, Transport, Keyring } from '@shapeshiftoss/hdwallet-core'

export interface LedgerResponse {
  success: boolean,
  payload: any | { error: string },
  coin?: Coin,
  method?: string
}

export interface LedgerRequest {
  method: string,
  fromCallFn: boolean,
  action?: Function,
  coin?: string,
  args?: string[] | boolean[] | object[]
}

export interface LedgerEventInfo {
  coin: string,
  method: string,
  response: string | void | Error,
  eventType: string,
  fromWallet: boolean
}

export abstract class LedgerTransport extends Transport {
  transport: any

  constructor(transport: any, keyring: Keyring) {
    super(keyring)
    this.transport = transport
  }

  public abstract async cancel(): Promise<void>

  public abstract async getDeviceInfo(): Promise<any>

  public abstract async call(coin: string, method: string, ...args: any[]): Promise<LedgerResponse>

  /**
  * Optional open and close functions for managing transport connection
  */
  public async open(): Promise<any> { return }
  public async close(): Promise<any> { return }
}
