const retry = require('async-retry')
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

interface LedgerEventInfo {
  coin: string,
  method: string,
  response: string,
  eventType: string,
  fromWallet: boolean
}

export class LedgerWebUsbTransport extends LedgerTransport {
  device: USBDevice

  callInProgress: {
    main: Promise<any>,
    debug: Promise<any>
  } = {
    main: undefined,
    debug: undefined
  }

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
    console.log('CALL')
    let response
    try {
      response =  await this.sendToLedger({
        method,
        coin,
        args
      })
    } catch(e) {
      console.log(e)
      response = 'ya'
    }

    console.log({ response })

    return response
  }

  public async sendToLedger(sendObj: LedgerRequest): Promise<LedgerResponse> {
    let { action, coin, method, args } = sendObj

    this.emitEvent({ coin, method, response: '', fromWallet: false, eventType: 'call' })

    let makePromise = async () => {
      let response
      try {
        // might need some work to be more flexible, it works tho - rj
        response = action ? await action(this.transport) : await this._createLedgerCall({ coin, method })(...args)
      } catch (e) {
        this.emitEvent({ coin, method, response: e.message, fromWallet: true, eventType: 'error' })

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

      return result
    }

    /////////
    this.callInProgress.main = (async () => {
      // await this.cancellable(this.callInProgress.main)

      try {
        return makePromise()
      } catch(e) {
        console.log('from call in progress', e)
      } finally {
        console.log('FINISHED!')
        // this.userActionRequired = false
      }
    })()

    return await this.callInProgress.main
  }

  // public async cancel () {
  //   if (!this.userActionRequired) return
  //   try {
  //     this.callInProgress = { main: undefined, debug: undefined }
  //     const cancelMsg = new Messages.Cancel()
  //     await this.call(Messages.MessageType.MESSAGETYPE_CANCEL, cancelMsg, DEFAULT_TIMEOUT, false, this.userActionRequired)
  //   } catch (e) {
  //     console.error('Cancel Pending Error', e)
  //   } finally {
  //     this.callInProgress = { main: undefined, debug: undefined }
  //   }
  // }

  public async cancel() {
    try {

    } catch (e) {

    } finally {
      this.callInProgress = { main: undefined, debug: undefined }
    }

  }

  public emitEvent(ledgerEventInfo: LedgerEventInfo): void {
    const { coin, method, response, eventType, fromWallet } = ledgerEventInfo
    this.emit(`ledger.${coin}.${method}.${eventType}`, makeEvent({
      message_type: method,
      from_wallet: fromWallet,
      message: {
        response
      }
    }))
  }
}
