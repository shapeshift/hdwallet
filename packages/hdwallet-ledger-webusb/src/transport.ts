import { makeEvent, Keyring, WebUSBNotAvailable, WebUSBCouldNotInitialize, WebUSBCouldNotPair, ConflictingApp } from '@shapeshiftoss/hdwallet-core'
import { LedgerTransport, LedgerResponse } from '@shapeshiftoss/hdwallet-ledger'
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

export async function getFirstLedgerDevice(): Promise<USBDevice> {
  if (!(window && window.navigator.usb))
    throw new WebUSBNotAvailable()

  const existingDevices = await TransportWebUSB.list()

  return existingDevices.length > 0 ? existingDevices[0] : null
}

export async function openTransport(device: USBDevice): Promise<TransportWebUSB> {
  if (!(window && window.navigator.usb))
    throw new WebUSBNotAvailable()

  try {
    return await TransportWebUSB.open(device)
  } catch (err) {
    if (err.name === 'TransportInterfaceNotAvailable') {
      throw new ConflictingApp('Ledger')
    }

    throw new WebUSBCouldNotInitialize('Ledger', err.message)
  }
}

export async function getTransport(): Promise<TransportWebUSB> {
  if (!(window && window.navigator.usb))
    throw new WebUSBNotAvailable()

  try {
    return await TransportWebUSB.create()
  } catch (err) {
    if (err.name === 'TransportInterfaceNotAvailable') {
      throw new ConflictingApp('Ledger')
    }

    throw new WebUSBCouldNotPair('Ledger', err.message)
  }
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
    return await getDeviceInfo(this.transport)
  }

  public async open() {
    const ledgerTransport = await getTransport()
    this.transport = await getTransport()
  }

  public async close() {
    await this.transport.close()
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
