import { Coin, makeEvent, Keyring } from '@shapeshiftoss/hdwallet-core'
import { LedgerTransport } from '@shapeshiftoss/hdwallet-ledger'
import Transport from '@ledgerhq/hw-transport'
import Eth from '@ledgerhq/hw-app-eth'
import Btc from '@ledgerhq/hw-app-btc'

const TIMEOUT = 50 // timeout on user response

const RECORD_CONFORMANCE_MOCKS = false

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

function translateCoin(coin: string): (any) => void {
  return {
    'Btc': Btc,
    'Eth': Eth
  }[coin]
}

export class LedgerWebUsbTransport extends LedgerTransport {
  readonly hasPopup = false

  constructor(deviceID: string, transport: Transport<USBDevice>, keyring: Keyring) {
    super(deviceID, transport, keyring)
  }

  public async call(coin: string, method: string, ...args: any[]): Promise<LedgerResponse> {
    let response

    try {
      this.emit(`ledger.${coin}.${method}.call`, makeEvent({
        message_type: method,
        from_wallet: false,
        message: {}
      }))

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
