import {
  Keyring,
  HDWallet,
  Events,
  FirmwareUpdateRequired,
  WebUSBNotAvailable,
  WebUSBCouldNotPair
} from '@shapeshiftoss/hdwallet-core'
import { create as createWebUSBKeepKey } from '@shapeshiftoss/hdwallet-keepkey'
import { WebUSBKeepKeyTransport } from './transport'
import { VENDOR_ID, WEBUSB_PRODUCT_ID, HID_PRODUCT_ID } from './utils'

function hasDebug(device: USBDevice): boolean {
    return device.configurations.length > 2
}

export class WebUSBKeepKeyAdapter {

  keyring: Keyring

  constructor(keyring: Keyring) {
    this.keyring = keyring
    // If we have access to WebUSB, register callbacks
    if (window && window.navigator.usb) {
      window.navigator.usb.addEventListener('connect', this.handleConnectWebUSBKeepKey.bind(this))
      window.navigator.usb.addEventListener('disconnect', this.handleDisconnectWebUSBKeepKey.bind(this))
    }
  }

  public static useKeyring(keyring: Keyring) {
    return new WebUSBKeepKeyAdapter(keyring)
  }

  private async handleConnectWebUSBKeepKey (e: USBConnectionEvent): Promise<void> {
    if (e.device.vendorId !== VENDOR_ID && e.device.productId !== WEBUSB_PRODUCT_ID) return

    try {
      await this.initialize([e.device])
      this.keyring.emit([e.device.productName, e.device.serialNumber, Events.CONNECT], e.device.serialNumber)
    } catch(error) {
      this.keyring.emit([e.device.productName, e.device.serialNumber, Events.FAILURE], [e.device.serialNumber, {message: { code: error.type, ...error}}])
    }
  }

  private async handleDisconnectWebUSBKeepKey (e: USBConnectionEvent): Promise<void> {
    if (e.device.vendorId !== VENDOR_ID && e.device.productId !== WEBUSB_PRODUCT_ID) return

    try {
      await this.keyring.remove(e.device.serialNumber)
    } catch(e) {
      console.error(e)
    } finally {
      this.keyring.emit([e.device.productName, e.device.serialNumber, Events.DISCONNECT], e.device.serialNumber)
    }
  }

  public async initialize (
    devices?: USBDevice[],
    tryDebugLink: boolean = false,
    autoConnect: boolean = true
  ): Promise<number> {
    if (!(window && window.navigator.usb))
      throw new WebUSBNotAvailable()

    const devicesToInitialize = devices || await window.navigator.usb.getDevices()

    let errors = []
    for (let i = 0; i < devicesToInitialize.length; i++) {
      const usbDevice = devicesToInitialize[i]
      if (usbDevice.vendorId !== VENDOR_ID)
        continue

      if (usbDevice.productId !== WEBUSB_PRODUCT_ID) {
        // 🚨 Workaround for bug when an error is thrown inside for loop.
        // https://github.com/rpetrich/babel-plugin-transform-async-to-promises/issues/32
        errors.push(new FirmwareUpdateRequired("KeepKey", "6.1.0"))
        continue
      }

      if (this.keyring.wallets[usbDevice.serialNumber])
        continue

      let transport = new WebUSBKeepKeyTransport(usbDevice, this.keyring)

      if (autoConnect) {
        // Attempt to re-claim device
        if (usbDevice.opened) {
          await transport.usbDevice.close()
        }

        await transport.connect()

        if (tryDebugLink)
          await transport.tryConnectDebugLink()
      }

      let wallet = createWebUSBKeepKey(transport)
      this.keyring.add(wallet, usbDevice.serialNumber)

      if (autoConnect) {
        await wallet.initialize()
      }
    }

    // 🚨 Workaround for bug when an error is thrown inside for loop.
    if (errors.length) {
      throw errors[0]
    }

    return Object.keys(this.keyring.wallets).length
  }

  /**
   * Open the browser's webusb device picker.
   *
   * @param serialNumber To request a specific device, provide the
   *                     appropriate `serialNumber`, otherwise the user may pick any connected
   *                     KeepKey.
   * @param tryDebugLink Whether to attempt to connect to the device's debuglink endpoints.
   */
  public async pairDevice (serialNumber: string = undefined, tryDebugLink: boolean = false): Promise<HDWallet> {
    if (!(window && window.navigator.usb)) {
      throw new WebUSBNotAvailable()
    }

    let device
    try {
      device = await window.navigator.usb.requestDevice({ filters: [
        { vendorId: VENDOR_ID, productId: WEBUSB_PRODUCT_ID, serialNumber },
        { vendorId: VENDOR_ID, productId: HID_PRODUCT_ID, serialNumber }
      ] })
    } catch (e) {
      throw new WebUSBCouldNotPair('KeepKey', e.message)
    }

    await this.initialize([device], tryDebugLink, /*autoConnect=*/true)

    return this.keyring.get(device.serialNumber)
  }
}
