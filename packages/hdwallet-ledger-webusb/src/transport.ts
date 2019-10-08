import { makeEvent, Keyring } from '@shapeshiftoss/hdwallet-core'
import { LedgerTransport, LedgerResponse } from '@shapeshiftoss/hdwallet-ledger'
import Transport from '@ledgerhq/hw-transport'
import Eth from '@ledgerhq/hw-app-eth'
import Btc from '@ledgerhq/hw-app-btc'
import getDeviceInfo from '@ledgerhq/live-common/lib/hw/getDeviceInfo'

const RECORD_CONFORMANCE_MOCKS = false

function translateCoin(coin: string): (any) => void {
  return {
    'Btc': Btc,
    'Eth': Eth
  }[coin]
}

interface LedgerRequest {
  method: string,
  action?: Function,
  coin?: string,
  args?: any
}

export class LedgerWebUsbTransport extends LedgerTransport {
  device: USBDevice

  constructor(device: USBDevice, transport: Transport<USBDevice>, keyring: Keyring) {
    super(transport, keyring)
    this.device = device
  }

  private _createLedgerCall({ coin, method }: { coin: string, method: string }): any {
    return new (translateCoin(coin))(this.transport)[method]
  }

  public getDeviceID (): string {
    return (this.device as any).deviceID
  }

  public async getDeviceInfo(): Promise<LedgerResponse> {
    return await this.sendToLedger({
      action: getDeviceInfo,
      method: 'getDeviceInfo',
      coin: 'dashboard'
    })
  }

  public async call(coin: string, method: string, ...args: any[]): Promise<LedgerResponse> {
    return await this.sendToLedger({
      method,
      coin,
      args
    })
  }

  public async sendToLedger(sendObj: LedgerRequest): Promise<LedgerResponse> {
    let response
    let { action, coin, method, args } = sendObj
    this.emit(`ledger.${coin}.${method}.call`, makeEvent({
      message_type: method,
      from_wallet: false,
      message: {}
    }))

    try {
      // might need some work to be more flexible, it works tho - rj
      response = action ? await action(this.transport) : await this._createLedgerCall({ coin, method })(...args)
    } catch (e) {
      console.error(e)
      return {
        success: false,
        payload: { error: e.toString() },
        coin,
        method,
      }
    }

    let result = {
      success: true,
      payload: response,
      coin,
      method,
    }

    if (RECORD_CONFORMANCE_MOCKS) {
      // May need a slight amount of cleanup on escaping `'`s.
      console.log(`this.memoize('${coin}', '${method}',\n  JSON.parse('${JSON.stringify(args)}'),\n  JSON.parse('${JSON.stringify(result)}'))`)
    }

    return result
  }
}
