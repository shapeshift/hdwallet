import { create as createLedger } from '@shapeshift/hdwallet-ledger'
import { Events, Keyring, HDWallet, WebUSBNotAvailable } from '@shapeshift/hdwallet-core'
import { LedgerDevice, LedgerWebUsbTransport } from './transport'
import TransportWebUSB from '@ledgerhq/hw-transport-webusb'

export type DeviceID = string

export class WebUSBLedgerAdapter {
  keyring: Keyring

  private static _deviceIDToPath = new Map()

  constructor(keyring: Keyring) {
    this.keyring = keyring
  }

  public static useKeyring(keyring: Keyring) {
    return new WebUSBLedgerAdapter(keyring)
  }

  public async addDevice (deviceID: string, path: string): Promise<void> {
    WebUSBLedgerAdapter._deviceIDToPath.set(deviceID, path)
    await this.initialize([{ path, deviceID }])
  }

  public get (device: LedgerDevice): HDWallet {
    return this.keyring.get(device.deviceID)
  }

  public static newDeviceID (): string {
    // Ledger doesn't have deviceID, so we have to invent ephemeral ones.
    return 'webusb#' + Object.keys(this._deviceIDToPath).length.toString()
  }

  public async initialize (devices?: LedgerDevice[]): Promise<number> {
    if (!(window && window.navigator.usb))
      throw new WebUSBNotAvailable()

    const devicesToInitialize = devices || await TransportWebUSB.list()

    for (let i = 0; i < devicesToInitialize.length; i++) {
      const device = devicesToInitialize[i]
      if (this.keyring.wallets[device.deviceID]) {
        await this.keyring.remove(device.deviceID)
      }

      let ledgerTransport
      try {
        ledgerTransport = await TransportWebUSB.open(device)
      } catch (e) {
        console.error(`Could not initialize ${device.productName}. No app open on device?`, e)
        continue
      }

      let deviceID = WebUSBLedgerAdapter.newDeviceID()
      let transport = new LedgerWebUsbTransport(deviceID, ledgerTransport, this.keyring)

      let wallet = createLedger(transport)
      this.keyring.add(wallet, deviceID)
      this.keyring.emit(["Ledger", deviceID, Events.CONNECT], deviceID)
    }
    return Object.keys(this.keyring.wallets).length
  }

  public async pairDevice (): Promise<HDWallet> {
    if (!(window && window.navigator.usb))
      throw new WebUSBNotAvailable()

    let ledgerTransport = await TransportWebUSB.request()

    const deviceID = WebUSBLedgerAdapter.newDeviceID()
    const transport = await new LedgerWebUsbTransport(deviceID, ledgerTransport, this.keyring)

    const wallet = createLedger(transport)
    this.keyring.add(wallet, deviceID)
    this.keyring.emit(["Ledger", deviceID, Events.CONNECT], deviceID)

    return wallet
  }
}
