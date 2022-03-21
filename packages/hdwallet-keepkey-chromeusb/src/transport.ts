import * as core from "@shapeshiftoss/hdwallet-core";
import * as keepkey from "@shapeshiftoss/hdwallet-keepkey";

import { assertChromeUSB, chromeUSB, makePromise, VENDOR_ID, WEBUSB_PRODUCT_ID } from "./utils";

export class TransportDelegate implements keepkey.TransportDelegate {
  usbDevice: USBDevice & { serialNumber: string };
  private connectionHandle: any;

  constructor(usbDevice: USBDevice & { serialNumber: string }) {
    if (usbDevice.vendorId !== VENDOR_ID) throw new core.WebUSBCouldNotPair("KeepKey", "bad vendor id");
    if (usbDevice.productId !== WEBUSB_PRODUCT_ID) throw new core.FirmwareUpdateRequired("KeepKey", "6.1.0");
    this.usbDevice = usbDevice;
  }

  static async create(usbDevice: USBDevice & { serialNumber: string }): Promise<TransportDelegate | null> {
    if (usbDevice.vendorId !== VENDOR_ID) return null;
    return new TransportDelegate(usbDevice);
  }

  async isOpened(): Promise<boolean> {
    return this.connectionHandle.interface > -1;
  }

  async getDeviceID(): Promise<string> {
    return this.usbDevice.serialNumber;
  }

  async connect(): Promise<void> {
    assertChromeUSB(chromeUSB);
    if (await this.isOpened()) throw new Error("cannot connect an already-connected connection");
    this.connectionHandle = await makePromise(chromeUSB.openDevice, this.usbDevice);

    if (this.connectionHandle.configuration === null)
      await makePromise(chromeUSB.setConfiguration, this.connectionHandle, 1);
    await makePromise(chromeUSB.claimInterface, this.connectionHandle, 0);
  }

  async disconnect(): Promise<void> {
    assertChromeUSB(chromeUSB);
    try {
      // If the device is disconnected, this will fail and throw, which is fine.
      chromeUSB.closeDevice(this.connectionHandle);
    } catch (e) {
      console.warn("Disconnect Error (Ignored):", e);
    }
  }

  async writeChunk(buffer: Uint8Array): Promise<void> {
    assertChromeUSB(chromeUSB);
    await makePromise(chromeUSB.interruptTransfer, this.connectionHandle, {
      direction: "out",
      endpoint: 1,
      data: core.toArrayBuffer(buffer),
      timeout: 0,
    });
  }

  async readChunk(): Promise<Uint8Array> {
    assertChromeUSB(chromeUSB);
    const { resultCode, data } = await makePromise(chromeUSB.interruptTransfer, this.connectionHandle, {
      direction: "in",
      endpoint: 1,
      length: keepkey.SEGMENT_SIZE + 1,
      timeout: 0,
    });
    console.debug(resultCode, data);
    if (resultCode > 0) throw new Error("Error occured reading chunk");
    return data;
  }
}
