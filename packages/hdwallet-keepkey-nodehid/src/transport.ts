import * as keepkey from "@shapeshiftoss/hdwallet-keepkey";
import * as hid from "node-hid";

export type Device = hid.Device & { path: string; serialNumber: string };

export class TransportDelegate implements keepkey.TransportDelegate {
  public hidRef: hid.HID | undefined;
  public hidDevice: Device;

  constructor(hidDevice: Device, hidRef?: hid.HID) {
    this.hidDevice = hidDevice;
    this.hidRef = hidRef || new hid.HID(hidDevice.path);
  }

  async getDeviceID(): Promise<string> {
    return this.hidDevice.serialNumber;
  }

  async isOpened(): Promise<boolean> {
    return !!this.hidRef;
  }

  async connect(): Promise<void> {
    if (!(await this.isOpened())) throw new Error("cannot reconnect a disconnected connection");
  }

  async disconnect(): Promise<void> {
    try {
      const oldHidRef = this.hidRef;
      this.hidRef = undefined;
      // If the device is disconnected, this will fail and throw, which is fine.
      await oldHidRef?.close();
    } catch (e) {
      console.warn("Disconnect Error (Ignored):", e);
    }
  }

  async readChunk(): Promise<Uint8Array> {
    if (!(await this.isOpened())) throw new Error("cannot read from a closed connection");
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = await this.hidRef!.readSync();
    return new Uint8Array(result);
  }

  async writeChunk(buf: Uint8Array): Promise<void> {
    if (!(await this.isOpened())) throw new Error("cannot write to a closed connection");
    const numArray = buf.reduce((a, x, i) => ((a[i] = x), a), new Array<number>(buf.length));
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await this.hidRef!.write(numArray);
  }
}
