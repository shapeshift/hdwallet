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

export class LedgerWebUsbTransport extends LedgerTransport {
  device: USBDevice

  constructor(device: USBDevice, transport: Transport<USBDevice>, keyring: Keyring) {
    super(transport, keyring)
    this.device = device
  }

  public getDeviceID (): string {
    return (this.device as any).deviceID
  }

  public async getDeviceInfo(): Promise<any> {
    let response;
    this.emit('ledger.getDeviceInfo', makeEvent({
      message_type: 'getDeviceInfo',
      from_wallet: false,
      message: {}
    }))

    try {
      response = await getDeviceInfo(this.transport)
    } catch (e) {

      return {
        success: false,
        payload: { error: e.toString() }
      }
    }

    return {
      success: true,
      payload: response
    }
  }

  public async call(coin: string, method: string, ...args: any[]): Promise<LedgerResponse> {
    let response
    this.emit(`ledger.${coin}.${method}.call`, makeEvent({
      message_type: method,
      from_wallet: false,
      message: {}
    }))

    try {
      response = await new (translateCoin(coin))(this.transport)[method](...args)
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
