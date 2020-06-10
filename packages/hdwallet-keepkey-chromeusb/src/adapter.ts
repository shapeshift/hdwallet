import {
  Keyring,
  Events,
  FirmwareUpdateRequired,
} from "@shapeshiftoss/hdwallet-core";
import { create as createHIDKeepKey } from "@shapeshiftoss/hdwallet-keepkey";
import { ChromeUSBKeepKeyTransport, getDevices } from "./transport";
import { VENDOR_ID, WEBUSB_PRODUCT_ID } from "./utils";

const c = chrome as any;

export class ChromeUSBKeyring {
  keyring: Keyring;

  constructor(keyring: Keyring) {
    this.keyring = keyring;
    if (!c.usb)
      throw new Error(
        "ChromeUSB is not available in this process. This package is intended for Chrome apps and extensions."
      );

    c.usb.onDeviceAdded.addListener(this.handleDisconnectKeepKey.bind(this));
    c.usb.onDeviceRemoved.addListener(this.handleConnectKeepKey.bind(this));
  }

  public async initialize(
    devices?: USBDevice[],
    autoConnect: boolean = true
  ): Promise<number> {
    if (!(chrome && c.usb))
      throw new Error("ChromeUSB not supported in your browser!");

    const devicesToInitialize = devices || (await getDevices());

    for (let i = 0; i < devicesToInitialize.length; i++) {
      const usbDevice = devicesToInitialize[i];

      if (usbDevice.vendorId !== VENDOR_ID) continue;

      if (usbDevice.productId !== WEBUSB_PRODUCT_ID)
        throw new FirmwareUpdateRequired("KeepKey", "6.1.0");

      if (this.keyring.wallets[usbDevice.serialNumber]) {
        await this.keyring.remove(usbDevice.serialNumber);
      }

      let wallet = createHIDKeepKey(
        new ChromeUSBKeepKeyTransport(usbDevice, false, this.keyring)
      );

      if (autoConnect) await wallet.initialize();

      this.keyring.add(wallet, usbDevice.serialNumber);
    }

    return Object.keys(this.keyring.wallets).length;
  }

  protected handleConnectKeepKey(device: USBDevice): void {
    this.initialize([device])
      .then(() =>
        this.keyring.emit(
          [device.productName, device.serialNumber, Events.CONNECT],
          device.serialNumber
        )
      )
      .catch(console.error);
  }

  protected handleDisconnectKeepKey(device: USBDevice): void {
    this.keyring
      .remove(device.serialNumber)
      .then(() =>
        this.keyring.emit(
          [device.productName, device.serialNumber, Events.DISCONNECT],
          device.serialNumber
        )
      )
      .catch(() =>
        this.keyring.emit(
          [device.productName, device.serialNumber, Events.DISCONNECT],
          device.serialNumber
        )
      );
  }
}
