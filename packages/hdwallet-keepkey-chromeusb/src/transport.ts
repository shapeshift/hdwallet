/// <reference path="../node_modules/@types/chrome/index.d.ts" />

import { Keyring } from "@shapeshiftoss/hdwallet-core";
import { SEGMENT_SIZE, KeepKeyTransport } from "@shapeshiftoss/hdwallet-keepkey";
import * as ByteBuffer from "bytebuffer";
import { VENDOR_ID, WEBUSB_PRODUCT_ID, HID_PRODUCT_ID, makePromise } from "./utils";

const {
  default: { concat, wrap },
} = ByteBuffer as any;

const c = chrome as any;

export function getDevices(): Promise<USBDevice[]> {
  if (!c.usb) {
    throw new Error(
      "ChromeUSB is not available in this process. This package is intended for Chrome apps and extensions."
    );
  }
  return makePromise(c.usb.getDevices, {
    filters: [
      {
        vendorId: VENDOR_ID,
        productId: WEBUSB_PRODUCT_ID,
      },
      {
        vendorId: VENDOR_ID,
        productId: HID_PRODUCT_ID,
      },
    ],
  }) as Promise<USBDevice[]>;
}

export class ChromeUSBKeepKeyTransport extends KeepKeyTransport {
  public chromeUSBDevice: USBDevice;

  private connectionHandle: any;

  constructor(chromeUSBDevice: USBDevice, debugLink: boolean = false, keyring: Keyring) {
    super(keyring);
    this.debugLink = debugLink;
    this.chromeUSBDevice = chromeUSBDevice;
  }

  public getVendor() {
    return "KeepKey";
  }

  public async getDeviceID(): Promise<string> {
    return this.chromeUSBDevice.serialNumber;
  }

  public async isOpened(): Promise<boolean> {
    return this.connectionHandle.interface > -1;
  }

  public async getFirmwareHash(firmware: ArrayBuffer): Promise<ArrayBuffer> {
    const hash = await window.crypto.subtle.digest(
      {
        name: "SHA-256",
      },
      new Uint8Array(firmware) //The data you want to hash as an ArrayBuffer
    );

    return hash;
  }

  public async connect(): Promise<void> {
    if (await this.isOpened()) return;
    this.connectionHandle = await makePromise(c.usb.openDevice, this.chromeUSBDevice);

    if (this.connectionHandle.configuration === null)
      await makePromise(c.usb.setConfiguration, this.connectionHandle, 1);
    await makePromise(c.usb.claimInterface, this.connectionHandle, 0);
  }

  public async disconnect(): Promise<void> {
    try {
      // If the device is disconnected, this will fail and throw, which is fine.
      c.usb.closeDevice(this.connectionHandle);
    } catch (e) {
      console.log("Disconnect Error (Ignored):", e);
    }
  }

  public getEntropy(length: number = 64): Uint8Array {
    return window.crypto.getRandomValues(new Uint8Array(length));
  }

  protected async write(buff: ByteBuffer): Promise<void> {
    // break frame into segments
    for (let i = 0; i < buff.limit; i += SEGMENT_SIZE) {
      let segment = buff.toArrayBuffer().slice(i, i + SEGMENT_SIZE);
      let padding = new Array(SEGMENT_SIZE - segment.byteLength + 1).join("\0");
      let fragments: Array<any> = [];
      fragments.push([63]);
      fragments.push(segment);
      fragments.push(padding);
      const fragmentBuffer = concat(fragments);
      await this.writeChunk(fragmentBuffer);
    }
  }

  protected async read(): Promise<ByteBuffer> {
    let first = await this.readChunk();
    console.log("read", first);
    // Check that buffer starts with: "?##" [ 0x3f, 0x23, 0x23 ]
    // "?" = USB marker, "##" = KeepKey magic bytes
    // Message ID is bytes 4-5. Message length starts at byte 6.
    const valid = (first.readUint32(0) & 0xffffff00) === 0x3f232300;
    const msgLength = first.readUint32(5);
    console.log("msgLength", msgLength);
    if (valid && msgLength >= 0) {
      // FIXME: why doesn't ByteBuffer.concat() work?
      const buffer = new Uint8Array(9 + 2 + msgLength);
      for (let k = 0; k < first.limit; k++) {
        buffer[k] = first.readUint8(k);
      }
      let offset = first.limit;

      while (offset < buffer.length) {
        const next = await this.readChunk();
        // Drop USB "?" packet identifier in the first byte
        for (let k = 1; k < next.limit && offset < buffer.length; k++) {
          buffer[offset] = next.readUint8(k);
          offset++;
        }
      }

      return wrap(buffer);
    }
  }

  private async writeChunk(buffer: ByteBuffer): Promise<USBOutTransferResult> {
    // return this.usbDevice.transferOut(1, buffer.toArrayBuffer())
    return makePromise(c.usb.interruptTransfer, this.connectionHandle, {
      direction: "out",
      endpoint: 1,
      data: buffer.toArrayBuffer(),
      timeout: 0,
    });
  }

  private async readChunk(): Promise<ByteBuffer> {
    const { resultCode, data } = await makePromise(c.usb.interruptTransfer, this.connectionHandle, {
      direction: "in",
      endpoint: 1,
      length: SEGMENT_SIZE + 1,
      timeout: 0,
    });
    console.log(resultCode, data);
    if (resultCode > 0) return Promise.reject(new Error("Error occured reading chunk"));
    return Promise.resolve(wrap(data));
  }
}
