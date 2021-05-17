import { TransportDelegate as KeepKeyTransportDelegate } from "@shapeshiftoss/hdwallet-keepkey";
import { Device as NodeHIDDevice, HID } from "node-hid";
import { VENDOR_ID, PRODUCT_ID } from "./utils";

export function requestPair(): HID {
  return new HID(VENDOR_ID, PRODUCT_ID);
}

export class TransportDelegate implements KeepKeyTransportDelegate {
  public hidRef: HID;
  public hidDevice: NodeHIDDevice;

  constructor(hidDevice: NodeHIDDevice, hidRef?: HID) {
    this.hidDevice = hidDevice;
    this.hidRef = hidRef || new HID(hidDevice.path);
  }

  async getDeviceID(): Promise<string> {
    return this.hidDevice.serialNumber;
  }

  async isOpened(): Promise<boolean> {
    return this.hidDevice.interface > -1;
  }

  async connect(): Promise<void> {
    if (await this.isOpened()) throw new Error("cannot connect an already-connected connection");
    this.hidRef.readSync();
  }

  async disconnect(): Promise<void> {
    try {
      // If the device is disconnected, this will fail and throw, which is fine.
      await this.hidRef.close();
    } catch (e) {
      console.log("Disconnect Error (Ignored):", e);
    }
  }

  async readChunk(): Promise<Uint8Array> {
    const result = await this.hidRef.readSync();
    return new Uint8Array(result);
  }

  async writeChunk(buf: Uint8Array): Promise<void> {
    const numArray = buf.reduce((a, x, i) => (a[i] = x, a), new Array<number>(buf.length));
    await this.hidRef.write(numArray);
  }
}
