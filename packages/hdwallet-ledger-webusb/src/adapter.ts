import { create as createLedger } from '@shapeshiftoss/hdwallet-ledger'
import { Events, Keyring, HDWallet, WebUSBNotAvailable, WebUSBCouldNotPair } from '@shapeshiftoss/hdwallet-core'
import { LedgerWebUsbTransport } from './transport'
import TransportWebUSB from '@ledgerhq/hw-transport-webusb'

const VENDOR_ID = 11415

export class WebUSBLedgerAdapter {
  keyring: Keyring

  constructor(keyring: Keyring) {
    this.keyring = keyring
  }

  public static useKeyring(keyring: Keyring) {
    return new WebUSBLedgerAdapter(keyring)
  }

  public get (device: USBDevice): HDWallet {
    return this.keyring.get((device as any).deviceID)
  }

  public async initialize (devices?: USBDevice[]): Promise<number> {
    if (!(window && window.navigator.usb))
      throw new WebUSBNotAvailable()

    const devicesToInitialize = devices || await TransportWebUSB.list()

    let ledgerTransport
    for (let i = 0; i < devicesToInitialize.length; i++) {
      const device = devicesToInitialize[i]

      if (device.vendorId !== VENDOR_ID) { continue }

      // remove last connected ledger from keyring since we don't have unique identifier
      if (!device.deviceID) {
        device.deviceID = 'webusb-ledger'
        await this.keyring.remove(device.deviceID)
      }

      if (this.keyring.wallets[device.deviceID]) { continue }

      try {
        ledgerTransport = await TransportWebUSB.open(device)
      } catch (e) {
        console.error(`Could not initialize ${device.manufacturerName} ${device.productName}.`, e)
        continue
      }

      const wallet = createLedger(new LedgerWebUsbTransport(device, ledgerTransport, this.keyring))

      this.keyring.add(wallet, device.deviceID)
      this.keyring.emit(["Ledger", device.deviceID, Events.CONNECT], device.deviceID)
    }

    return Object.keys(this.keyring.wallets).length
  }

  public async pairDevice (): Promise<HDWallet> {
    if (!(window && window.navigator.usb))
      throw new WebUSBNotAvailable()

    let transport
    try {
      transport = await TransportWebUSB.request()
    } catch (err) {
      throw new WebUSBCouldNotPair('Ledger', err.message)
    }

    const device = transport.device

    await this.initialize([device])

    return this.keyring.get(device.deviceID)
  }
}
