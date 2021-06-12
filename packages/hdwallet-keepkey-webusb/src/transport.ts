import * as core from "@shapeshiftoss/hdwallet-core";
import * as keepkey from "@shapeshiftoss/hdwallet-keepkey";

import { VENDOR_ID, WEBUSB_PRODUCT_ID } from "./utils"

export class TransportDelegate implements keepkey.TransportDelegate {
  usbDevice: USBDevice;
  keyring: core.Keyring;

  constructor(usbDevice: USBDevice) {
    if (usbDevice.vendorId !== VENDOR_ID) return null;
    if (usbDevice.productId !== WEBUSB_PRODUCT_ID) throw new core.FirmwareUpdateRequired("KeepKey", "6.1.0");
    this.usbDevice = usbDevice;
  }

  static async create(device: USBDevice) {
    return new TransportDelegate(device);
  }

  async getDeviceID(): Promise<string> {
    return this.usbDevice.serialNumber;
  }

  async isOpened(): Promise<boolean> {
    return this.usbDevice.opened;
  }

  async connect(): Promise<void> {
    await this.usbDevice.open();
    if (this.usbDevice.configuration === null) await this.usbDevice.selectConfiguration(1);

    try {
      await this.usbDevice.claimInterface(0);
    } catch (e) {
      console.error("Could not claim interface 0", this.usbDevice, { e });
      if (e.code === 18)
        // "The requested interface implements a protected class"
        throw new core.FirmwareUpdateRequired("KeepKey", "6.1.0");
      if (e.code === 19)
        // "Unable to claim interface"
        throw new core.ConflictingApp("KeepKey");
      throw e;
    }
  }

  async tryConnectDebugLink(): Promise<boolean> {
    // We have to use "guess & check" here because the browser doesn't give us a
    // way to inspect the descriptors :(
    try {
      await this.usbDevice.claimInterface(1);
      return true;
    } catch (e) {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.usbDevice.opened) return;
    try {
      // If the device is disconnected, this will fail and throw, which is fine.
      await this.usbDevice.close();
    } catch (e) {
      console.log("Error closing connection with usbDevice");
    }
  }

  async writeChunk(buf: Uint8Array, debugLink: boolean): Promise<void> {
    await this.usbDevice.transferOut(debugLink ? 2 : 1, buf.buffer);
  }

  async readChunk(debugLink: boolean): Promise<Uint8Array> {
    const { status, data } = await this.usbDevice.transferIn(debugLink ? 2 : 1, keepkey.SEGMENT_SIZE + 1);

    if (status === "stall") {
      await this.usbDevice.clearHalt("out", debugLink ? 2 : 1);
    }

    return new Uint8Array(data.buffer);
  }
}
