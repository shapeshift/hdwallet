import { Coin, Transport, Keyring } from '@shapeshiftoss/hdwallet-core'
import getDeviceInfo from '@ledgerhq/live-common/lib/hw/getDeviceInfo'

export type LedgerDevice = {
  path: string,
  deviceID: string
}

export interface LedgerResponse {
  success: boolean,
  payload: any | { error: string },
  coin: Coin,
  method: string
}

export abstract class LedgerTransport extends Transport {
  readonly hasPopup = false
  readonly deviceID
  transport

  constructor(deviceID: string, transport: any, keyring: Keyring) {
    super(keyring)
    this.deviceID = deviceID
    this.transport = transport
  }

  public getDeviceID (): string {
    return this.deviceID
  }

  public async getDeviceInfo(): Promise<any> {
    return await getDeviceInfo(this.transport)
  }


  public abstract async call(coin: string, method: string, ...args: any[]): Promise<LedgerResponse>
}
