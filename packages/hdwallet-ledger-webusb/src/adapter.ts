import { create as createLedger } from '@shapeshiftoss/hdwallet-ledger'
import { Events, Keyring, HDWallet } from '@shapeshiftoss/hdwallet-core'
import { LedgerWebUsbTransport, getFirstLedgerDevice, getTransport, openTransport } from './transport'

const VENDOR_ID = 11415
const APP_NAVIGATION_DELAY = 1000

export class WebUSBLedgerAdapter {
  keyring: Keyring
  connectTimestamp: number = 0
  connectTimeoutId: number = 0

  constructor(keyring: Keyring) {
    this.keyring = keyring

    if (window && window.navigator.usb) {
      window.navigator.usb.addEventListener('connect', this.handleConnectWebUSBLedger.bind(this))
      window.navigator.usb.addEventListener('disconnect', this.handleDisconnectWebUSBLedger.bind(this))
    }
  }

  private timeout(ms: number): Promise<void> {
    return new Promise(resolve => {
      if (this.connectTimeoutId > 0) {
        window.clearTimeout(this.connectTimeoutId)
      }
      this.connectTimeoutId = window.setTimeout(resolve, ms)
    })
  }

  public static useKeyring(keyring: Keyring) {
    return new WebUSBLedgerAdapter(keyring)
  }

  private async handleConnectWebUSBLedger(e: USBConnectionEvent): Promise<void> {
    if (e.device.vendorId !== VENDOR_ID) return

    this.connectTimestamp = e.timeStamp

    await this.timeout(APP_NAVIGATION_DELAY) // timeout gives time to detect if it is an app navigation based disconnec/connect event

    try {
      await this.initialize(e.device)
      this.keyring.emit([e.device.manufacturerName, e.device.productName, Events.CONNECT], e.device.serialNumber)
    } catch(error) {
      this.keyring.emit([e.device.manufacturerName, e.device.productName, Events.FAILURE], [e.device.serialNumber, {message: { code: error.type, ...error}}])
    } finally {
      this.connectTimestamp = 0
    }
  }

  private async handleDisconnectWebUSBLedger(e: USBConnectionEvent): Promise<void> {
    if (e.device.vendorId !== VENDOR_ID) return

    await this.timeout(APP_NAVIGATION_DELAY) // timeout gives time to detect if it is an app navigation based disconnec/connect event

    if (this.connectTimestamp !== 0) return

    try {
      await this.keyring.remove(e.device.serialNumber)
    } catch(e) {
      console.error(e)
    } finally {
      this.keyring.emit([e.device.manufacturerName, e.device.productName, Events.DISCONNECT], e.device.serialNumber)
    }
  }

  public get (device: USBDevice): HDWallet {
    return this.keyring.get((device as any).serialNumber)
  }

  // without unique device identifiers, we should only ever have one ledger device on the keyring at a time
  public async initialize(usbDevice?: USBDevice): Promise<number> {
    const device = usbDevice || await getFirstLedgerDevice()

    if (device) {
      await this.keyring.remove(device.serialNumber)

      const ledgerTransport = await openTransport(device)

      const wallet = createLedger(new LedgerWebUsbTransport(device, ledgerTransport, this.keyring))

      this.keyring.add(wallet, device.serialNumber)
    }

    return Object.keys(this.keyring.wallets).length
  }

  public async pairDevice(): Promise<HDWallet> {
    const ledgerTransport = await getTransport()

    const device = ledgerTransport.device

    await this.initialize(device)

    return this.keyring.get(device.serialNumber)
  }
}
