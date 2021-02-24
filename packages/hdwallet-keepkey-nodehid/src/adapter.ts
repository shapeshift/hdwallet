import { Keyring, Events } from "@shapeshiftoss/hdwallet-core";
import { create as createHIDKeepKey } from "@shapeshiftoss/hdwallet-keepkey";
import { HIDKeepKeyTransport } from "./transport";
import * as HID from "node-hid";
import { VENDOR_ID, PRODUCT_ID } from "./utils";

export class HIDKeepKeyAdapter {
  keyring: Keyring;

  // public usbDetect = new USBDetect() // Must call keyring.usbDetect.stopMonitoring() for app to exit cleanly

  constructor(keyring: Keyring) {
    this.keyring = keyring;
  }

  public static useKeyring(keyring: Keyring) {
    return new HIDKeepKeyAdapter(keyring);
  }

  public async initialize(devices?: HID.Device[], autoConnect: boolean = true): Promise<number> {
    const devicesToInitialize =
      devices || HID.devices().filter((d) => d.vendorId === VENDOR_ID && d.productId === PRODUCT_ID);

    for (let i = 0; i < devicesToInitialize.length; i++) {
      const hidDevice = devicesToInitialize[i];

      if (this.keyring.wallets[hidDevice.serialNumber]) {
        await this.keyring.remove(hidDevice.serialNumber);
      }

      let wallet = createHIDKeepKey(new HIDKeepKeyTransport(hidDevice, this.keyring));

      if (autoConnect) await wallet.initialize();

      this.keyring.add(wallet, hidDevice.serialNumber);
    }

    return Object.keys(this.keyring.wallets).length;
  }

  protected handleConnectKeepKey(device: HID.Device): void {
    const deviceID = device.serialNumber;
    const devices = HID.devices().filter((d) => d.serialNumber === device.serialNumber);
    this.initialize(devices)
      .then(() => () => this.keyring.emit([device.product, deviceID, Events.CONNECT], deviceID))
      .catch(console.error);
  }

  protected handleDisconnectKeepKey(device: HID.Device): void {
    this.keyring
      .remove(device.serialNumber)
      .then(() => this.keyring.emit([device.product, device.serialNumber, Events.DISCONNECT], device.serialNumber))
      .catch(() => this.keyring.emit([device.product, device.serialNumber, Events.DISCONNECT], device.serialNumber));
  }
}
