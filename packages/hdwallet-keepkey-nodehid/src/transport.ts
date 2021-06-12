import { Keyring } from "@shapeshiftoss/hdwallet-core";
import { SEGMENT_SIZE, KeepKeyTransport } from "@shapeshiftoss/hdwallet-keepkey";
import * as ByteBuffer from "bytebuffer";
import { Device as NodeHIDDevice, HID } from "node-hid";
import { VENDOR_ID, PRODUCT_ID } from "./utils";
import { randomBytes, createHash } from "crypto";

const {
  default: { concat, wrap },
} = ByteBuffer as any;

export function requestPair(): HID {
  return new HID(VENDOR_ID, PRODUCT_ID);
}

export class HIDKeepKeyTransport extends KeepKeyTransport {
  public hidRef: HID;
  public hidDevice: NodeHIDDevice;

  private bufferQueue: ByteBuffer[] = [];

  constructor(hidDevice: NodeHIDDevice, keyring: Keyring, hidRef?: HID) {
    super(keyring);
    this.hidDevice = hidDevice;
    this.hidRef = hidRef || new HID(hidDevice.path);
  }

  public async getDeviceID(): Promise<string> {
    return this.hidDevice.serialNumber;
  }

  public getVendor(): string {
    return "keepkey.com";
  }

  public async getFirmwareHash(firmware: Buffer): Promise<Buffer> {
    const hash = createHash("sha256");
    hash.update(firmware);
    return hash.digest();
  }

  public get isOpened(): boolean {
    return this.hidDevice.interface > -1;
  }

  public async connect(): Promise<void> {
    if (this.isOpened) return;

    this.hidRef.readSync();
  }

  public async disconnect(): Promise<void> {
    try {
      // If the device is disconnected, this will fail and throw, which is fine.
      await this.hidRef.close();
    } catch (e) {
      console.log("Disconnect Error (Ignored):", e);
    }
  }

  public getEntropy(length: number = 64): Uint8Array {
    return randomBytes(length);
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

  private async readChunk(debugLink: boolean): Promise<ByteBuffer> {
    const result = await this.hidRef.readSync();
    return Promise.resolve(wrap(result));
  }

  protected async read(debugLink: boolean): Promise<ByteBuffer> {
    const first = await this.readChunk(debugLink);
    // Check that buffer starts with: "?##" [ 0x3f, 0x23, 0x23 ]
    // "?" = USB marker, "##" = KeepKey magic bytes
    // Message ID is bytes 4-5. Message length starts at byte 6.
    const valid = (first.readUint32(0) & 0xffffff00) === 0x3f232300;
    const msgLength = first.readUint32(5);
    if (valid && msgLength >= 0) {
      // FIXME: why doesn't ByteBuffer.concat() work?
      const buffer = new Uint8Array(9 + 2 + msgLength);
      for (let k = 0; k < first.limit; k++) {
        buffer[k] = first.readUint8(k);
      }
      let offset = first.limit;

      while (offset < buffer.length) {
        const next = await this.readChunk(debugLink);
        // Drop USB "?" reportId in the first byte
        for (let k = 1; k < next.limit && offset < buffer.length; k++) {
          buffer[offset] = next.readUint8(k);
          offset++;
        }
      }

      return wrap(buffer);
    }
  }

  private async writeChunk(buffer: ByteBuffer): Promise<number> {
    const arr: number[] = new Array(buffer.limit).fill(undefined);
    for (let i = buffer.offset; i < buffer.limit; i++) {
      arr[i] = buffer.readByte(i);
    }
    return this.hidRef.write(arr);
  }

  private enqueueBuffer(data: number[]): void {
    if (data.length) this.bufferQueue.push(wrap(data));
  }
}
