const retry = require('async-retry')
import { makeEvent, Keyring, WebUSBNotAvailable, WebUSBCouldNotInitialize, WebUSBCouldNotPair, ConflictingApp } from '@shapeshiftoss/hdwallet-core'
import { LedgerTransport, LedgerResponse, LedgerRequest, LedgerEventInfo } from '@shapeshiftoss/hdwallet-ledger'
import { handleError } from '@shapeshiftoss/hdwallet-ledger'
import Transport from '@ledgerhq/hw-transport'
import TransportWebUSB from '@ledgerhq/hw-transport-webusb'
import Eth from '@ledgerhq/hw-app-eth'
import Btc from '@ledgerhq/hw-app-btc'
import getDeviceInfo from '@ledgerhq/live-common/lib/hw/getDeviceInfo'

const RETRY_ATTEMPTS = 20

const RECORD_CONFORMANCE_MOCKS = false

function translateCoin(coin: string): (any) => void {
  return {
    'Btc': Btc,
    'Eth': Eth
  }[coin]
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

  isCancelled: boolean = false

  constructor(device: USBDevice, transport: Transport<USBDevice>, keyring: Keyring) {
    super(transport, keyring)
    this.device = device
  }

  public getDeviceID (): string {
    return (this.device as any).deviceID
  }

  public async getDeviceInfo(): Promise<LedgerResponse> {
    return await this.sendToLedger({
      action: getDeviceInfo,
      fromCallFn: false,
      method: 'getDeviceInfo',
      coin: 'dashboard'
    })
  }

  public async open() {
    const ledgerTransport = await getTransport()
    this.transport = await getTransport()
  }

  public async close() {
    await this.transport.close()
  }

  public async call(coin: string, method: string, ...args: any[]): Promise<LedgerResponse> {
    return  await this.sendToLedger({
      fromCallFn: true,
      args,
      method,
      coin
    })
  }

  public async sendToLedger(sendArgs: LedgerRequest): Promise<LedgerResponse> {
    let { action, coin, method, args, fromCallFn } = sendArgs
    let response

    // set it back to false in case it was true
    if (this.isCancelled) this.isCancelled = false

    try {
      // open transport if it's closed
      await this.open()

      console.log('TRANSPORT IS OPEN')

      response = fromCallFn ?
        await new (translateCoin(coin))(this.transport)[method](...args) :
        await action(this.transport)

      console.log('COMPLETE CALL')

      // close transport after every call
      await this.close()

      console.log('TRANSPORT IS CLOSED')

      // this.emitEvent({
      //   coin: 'none',
      //   method: 'retry',
      //   response,
      //   fromWallet: true,
      //   eventType: 'success'
      // })
    } catch (e) {
      // this.emitEvent({
      //   coin,
      //   method,
      //   response: e.message,
      //   fromWallet: true,
      //   eventType: 'error'
      // })

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

  public async cancel(): Promise<void> {
    this.isCancelled = true
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
