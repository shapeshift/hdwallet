import { SEGMENT_SIZE, KeepKeyTransport } from "@shapeshiftoss/hdwallet-keepkey";
import { ConflictingApp, FirmwareUpdateRequired, Keyring } from "@shapeshiftoss/hdwallet-core";
import { randomBytes, createHash } from "crypto";
import * as ByteBuffer from "bytebuffer";
const {
  default: { concat, wrap },
} = ByteBuffer as any;

export class NodeWebUSBKeepKeyTransport extends KeepKeyTransport {
  public usbDevice: USBDevice;

  constructor(usbDevice: USBDevice, keyring: Keyring) {
    super(keyring);
    this.usbDevice = usbDevice;
    this.debugLink = false;
  }

  public async getDeviceID(): Promise<string> {
    return this.usbDevice.serialNumber;
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
    return this.usbDevice.opened;
  }

  public async connect(): Promise<void> {
    if (this.isOpened) return;

    await this.usbDevice.open();

    if (this.usbDevice.configuration === null) await this.usbDevice.selectConfiguration(1);

    try {
      await this.usbDevice.claimInterface(0);
    } catch (e) {
      if (e.code === 18)
        // "The requested interface implements a protected class"
        throw new FirmwareUpdateRequired("KeepKey", "6.1.0");
      if (e.code === 19)
        // "Unable to claim interface"
        throw new ConflictingApp("KeepKey");
      throw e;
    }
  }

  public async tryConnectDebugLink(): Promise<boolean> {
    // We have to use "guess & check" here because the browser doesn't give us a
    // way to inspect the descriptors :(
    try {
      await this.usbDevice.claimInterface(1);
      this.debugLink = true;
    } catch (e) {
      this.debugLink = false;
    }
    return this.debugLink;
  }

  public async disconnect(): Promise<void> {
    try {
      // If the device is disconnected, this will fail and throw, which is fine.
      await this.usbDevice.close();
    } catch (e) {
      console.log("Disconnect Error (Ignored):", e);
    }
  }

  public getEntropy(length: number = 64): Uint8Array {
    return window.crypto.getRandomValues(new Uint8Array(length));
  }

  protected async write(buff: ByteBuffer, debugLink: boolean): Promise<void> {
    // break frame into segments
    for (let i = 0; i < buff.limit; i += SEGMENT_SIZE) {
      let segment = buff.toArrayBuffer().slice(i, i + SEGMENT_SIZE);
      let padding = new Array(SEGMENT_SIZE - segment.byteLength + 1).join("\0");
      let fragments: Array<any> = [];
      fragments.push([63]);
      fragments.push(segment);
      fragments.push(padding);
      const fragmentBuffer = concat(fragments);
      await this.writeChunk(fragmentBuffer, debugLink);
    }
  }

  protected async read(debugLink: boolean): Promise<ByteBuffer> {
    let first = await this.readChunk(debugLink);
    // Check that buffer starts with: "?##" [ 0x3f, 0x23, 0x23 ]
    // "?" = USB reportId, "##" = KeepKey magic bytes
    // Message ID is bytes 4-5. Message length starts at byte 6.
    const valid = (first.getUint32(0) & 0xffffff00) === 0x3f232300;
    const msgLength = first.getUint32(5);
    if (valid && msgLength >= 0) {
      // FIXME: why doesn't ByteBuffer.concat() work?
      const buffer = new Uint8Array(9 + 2 + msgLength);
      for (let k = 0; k < first.byteLength; k++) {
        buffer[k] = first.getUint8(k);
      }
      let offset = first.byteLength;

      while (offset < buffer.length) {
        const next = await this.readChunk(debugLink);
        // Drop USB "?" reportId in the first byte
        for (let k = 1; k < next.byteLength && offset < buffer.length; k++) {
          buffer[offset] = next.getUint8(k);
          offset++;
        }
      }

      return wrap(buffer);
    }
  }

  private async writeChunk(buffer: ByteBuffer, debugLink: boolean): Promise<USBOutTransferResult> {
    return this.usbDevice.transferOut(debugLink ? 2 : 1, buffer.toArrayBuffer());
  }

  private async readChunk(debugLink: boolean): Promise<DataView> {
    const result = await this.usbDevice.transferIn(debugLink ? 2 : 1, SEGMENT_SIZE + 1);

    if (result.status === "stall") {
      await this.usbDevice.clearHalt("out", debugLink ? 2 : 1);
    }

    return Promise.resolve(result.data);
  }
}
