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

  // change any at some point
  public async getDeviceInfo(): Promise<any> {
    console.log('SENDING DEVICE INFO')
    try {
      const deviceInfo = await getDeviceInfo(this.transport)
      return deviceInfo
    } catch (e) {
      console.error(e)
    }
  }


  public abstract async call(coin: string, method: string, ...args: any[]): Promise<LedgerResponse>
}
