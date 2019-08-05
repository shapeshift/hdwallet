import { Keyring, HDWallet, FirmwareUpdateRequired } from '@shapeshiftoss/hdwallet-core'
import { create as createKeepKey } from '@shapeshiftoss/hdwallet-keepkey'
import { NodeWebUSBKeepKeyTransport } from './transport'
import { VENDOR_ID, WEBUSB_PRODUCT_ID, HID_PRODUCT_ID } from './utils'

const usb = require('webusb').usb

function hasDebug(device: USBDevice): boolean {
    return device.configurations.length > 2
}

export class NodeWebUSBKeepKeyAdapter {

  keyring: Keyring

  constructor(keyring: Keyring) {
    this.keyring = keyring
    //this.usb.onconnect = this.handleConnectWebUSBKeepKey.bind(this)
    //this.usb.ondisconnect = this.handleDisconnectWebUSBKeepKey.bind(this)
  }

  public static useKeyring(keyring: Keyring) {
    return new NodeWebUSBKeepKeyAdapter(keyring)
  }

  /*
  private handleConnectWebUSBKeepKey (e: USBConnectionEvent): void {
    const deviceID = e.device.serialNumber
    this.initialize([e.device])
      .then(() => this.keyring.deviceEvents.emit('connect.KeepKey', deviceID))
      .catch(console.error)
  }

  private handleDisconnectWebUSBKeepKey (e: USBConnectionEvent): void {
    const deviceID = e.device.serialNumber
    this.keyring.remove(deviceID)
      .then(() => this.keyring.deviceEvents.emit('disconnect.KeepKey', deviceID))
      .catch(() => this.keyring.deviceEvents.emit('disconnect.KeepKey', deviceID))
  }
*/

  public async initialize (
    devices?: USBDevice[],
    tryDebugLink: boolean = false,
    autoConnect: boolean = true
  ): Promise<number> {
    const devicesToInitialize = devices || await usb.getDevices()

    for (let i = 0; i < devicesToInitialize.length; i++) {
      const usbDevice = devicesToInitialize[i]

      if (usbDevice.vendorId !== VENDOR_ID)
        continue

      if (usbDevice.productId !== WEBUSB_PRODUCT_ID)
        throw new FirmwareUpdateRequired("KeepKey", "6.1.0")

      if (this.keyring.wallets[usbDevice.serialNumber])
        continue

      let transport = new NodeWebUSBKeepKeyTransport(usbDevice, this.keyring)

      if (autoConnect) {
        await transport.connect()
        if (tryDebugLink)
          await transport.tryConnectDebugLink()
      }

      let wallet = createKeepKey(transport)

      if (autoConnect)
        await wallet.initialize()

      this.keyring.add(wallet, usbDevice.serialNumber)
    }
    return Object.keys(this.keyring.wallets).length
  }

  public async pairDevice (
    serialNumber: string = undefined,
    tryDebugLink: boolean = false
  ): Promise<HDWallet> {
    let device = await usb.requestDevice({ filters: [
      { vendorId: VENDOR_ID, productId: WEBUSB_PRODUCT_ID, serialNumber },
      { vendorId: VENDOR_ID, productId: HID_PRODUCT_ID, serialNumber }
    ] })

    if (device === undefined)
      throw new Error('Could not find a WebUsb KeepKey to pair with')

    await this.initialize([device], tryDebugLink, /*autoConnect=*/true)

    return this.keyring.get(device.serialNumber)
  }
}
