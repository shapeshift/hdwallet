const retry = require('async-retry')
import { makeEvent, Keyring, WebUSBNotAvailable, WebUSBCouldNotInitialize, WebUSBCouldNotPair, ConflictingApp } from '@shapeshiftoss/hdwallet-core'
import { LedgerTransport, LedgerResponse } from '@shapeshiftoss/hdwallet-ledger'
import { handleErrorForEvent } from '@shapeshiftoss/hdwallet-ledger'
import Transport from '@ledgerhq/hw-transport'
import TransportWebUSB from '@ledgerhq/hw-transport-webusb'
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
  args?: any[]
}

interface LedgerEventInfo {
  coin: string,
  method: string,
  response: string | void,
  eventType: string,
  fromWallet: boolean
}

export async function getFirstLedgerDevice(): Promise<USBDevice> {
  if (!(window && window.navigator.usb))
    throw new WebUSBNotAvailable()

  const existingDevices = await TransportWebUSB.list()

  return existingDevices.length > 0 ? existingDevices[0] : null
}

export async function openTransport(device: USBDevice): Promise<TransportWebUSB> {
  if (!(window && window.navigator.usb))
    throw new WebUSBNotAvailable()

  let ledgerTransport
  try {
    ledgerTransport = await TransportWebUSB.open(device)
  } catch (err) {
    if (err.name === 'TransportInterfaceNotAvailable') {
      throw new ConflictingApp('Ledger')
    }

    throw new WebUSBCouldNotInitialize('Ledger', err.message)
  }

  return ledgerTransport
}

export async function getTransport(): Promise<TransportWebUSB> {
  if (!(window && window.navigator.usb))
    throw new WebUSBNotAvailable()

  let ledgerTransport
  try {
    ledgerTransport = await TransportWebUSB.openConnected() || await TransportWebUSB.request()
  } catch (err) {
    if (err.name === 'TransportInterfaceNotAvailable') {
      throw new ConflictingApp('Ledger')
    }

    throw new WebUSBCouldNotPair('Ledger', err.message)
  }

  return ledgerTransport
}

export class LedgerWebUsbTransport extends LedgerTransport {
  device: USBDevice

  cancelCall: boolean = false

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
    const ledgerCall = new (translateCoin(coin))(this.transport)[method]
    return ledgerCall
  }

  public getDeviceID (): string {
    return (this.device as any).deviceID
  }

  public async getDeviceInfo(): Promise<LedgerResponse> {
    return await this.sendToLedger({
      action: getDeviceInfo,
      args: [this.transport],
      method: 'getDeviceInfo',
      coin: 'dashboard'
    })
  }

  public async open() {
    const ledgerTransport = await getTransport()
    this.transport = ledgerTransport
  }

  public async close() {
    await this.transport.close()
  }

  public async call(coin: string, method: string, ...args: any[]): Promise<LedgerResponse> {
    return  await this.sendToLedger({
      action: this._createLedgerCall({ coin, method }),
      args,
      method,
      coin
    })
  }

  public async sendToLedger(sendObj: LedgerRequest): Promise<LedgerResponse> {
    let response
    let { action, coin, method, args } = sendObj

    this.emitEvent({ coin, method, response: '', fromWallet: false, eventType: 'call' })

    try {
      await retry(async (bail) => {
        if (this.cancelCall) {
          this.cancelCall = false
          bail()
          return
        }

        response = await action(...args)
      }, {
        retries: 60,
        onRetry: (error, attempts) => {
          const response = handleErrorForEvent({
            success: false,
            coin,
            payload: { error: error.message }
          })

          console.log({ isRetry: true, error, attempts, response })

          if (attempts === 1) {
            this.emitEvent({
              coin: 'none',
              method: 'retry',
              response,
              fromWallet: true,
              eventType: 'response'
            })
          }
        },
        maxTimeout: 1000
      })
    } catch (e) {
      this.emitEvent({
        coin,
        method,
        response: e.message,
        fromWallet: true,
        eventType: 'error'
      })

      console.log({ response })

      return {
        success: false,
        payload: { error: e.toString() },
        coin,
        method,
      }
    }

    console.log({ response })

    let result = {
      success: true,
      payload: response,
      coin,
      method,
    }

    return result
  }

  public async cancel(): Promise<void> {
    return new Promise(() => this.cancelCall = true)
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
