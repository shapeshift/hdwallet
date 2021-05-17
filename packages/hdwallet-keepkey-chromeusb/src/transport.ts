/// <reference path="../node_modules/@types/chrome/index.d.ts" />

import { FirmwareUpdateRequired } from "@shapeshiftoss/hdwallet-core";
import { SEGMENT_SIZE, TransportDelegate as KeepKeyTransportDelegate } from "@shapeshiftoss/hdwallet-keepkey";
import { VENDOR_ID, WEBUSB_PRODUCT_ID, makePromise } from "./utils";

const c = chrome as any;

export class TransportDelegate implements KeepKeyTransportDelegate {
  usbDevice: USBDevice;
  private connectionHandle: any;

  constructor(usbDevice: USBDevice) {
    if (usbDevice.vendorId !== VENDOR_ID) return null;
    if (usbDevice.productId !== WEBUSB_PRODUCT_ID) throw new FirmwareUpdateRequired("KeepKey", "6.1.0");
    this.usbDevice = usbDevice;
  }

  async isOpened(): Promise<boolean> {
    return this.connectionHandle.interface > -1;
  }

  async getDeviceID(): Promise<string> {
    return this.usbDevice.serialNumber;
  }

  async connect(): Promise<void> {
    if (await this.isOpened()) throw new Error("cannot connect an already-connected connection");
    this.connectionHandle = await makePromise(c.usb.openDevice, this.usbDevice);

    if (this.connectionHandle.configuration === null) await makePromise(c.usb.setConfiguration, this.connectionHandle, 1);
    await makePromise(c.usb.claimInterface, this.connectionHandle, 0);
  }

  async disconnect(): Promise<void> {
    try {
      // If the device is disconnected, this will fail and throw, which is fine.
      c.usb.closeDevice(this.connectionHandle);
    } catch (e) {
      console.log("Disconnect Error (Ignored):", e);
    }
  }

  async writeChunk(buffer: Uint8Array): Promise<void> {
    await makePromise(c.usb.interruptTransfer, this.connectionHandle, {
      direction: "out",
      endpoint: 1,
      data: buffer.buffer,
      timeout: 0,
    });
  }

  async readChunk(): Promise<Uint8Array> {
    const { resultCode, data } = await makePromise(c.usb.interruptTransfer, this.connectionHandle, {
      direction: "in",
      endpoint: 1,
      length: SEGMENT_SIZE + 1,
      timeout: 0,
    });
    console.log(resultCode, data);
    if (resultCode > 0) throw new Error("Error occured reading chunk");
    return data;
  }
}
