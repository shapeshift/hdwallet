import axios, { AxiosInstance } from "axios";
import {
  SEGMENT_SIZE,
  KeepKeyTransport,
} from "@shapeshiftoss/hdwallet-keepkey";
import { Keyring } from "@shapeshiftoss/hdwallet-core";
import * as ByteBuffer from "bytebuffer";

const {
  default: { concat, wrap },
} = ByteBuffer as any;

export class TCPKeepKeyTransport extends KeepKeyTransport {
  public host: string;
  public keepkeyInstance: AxiosInstance;
  debugLink: boolean;

  constructor(host: string, keyring: Keyring) {
    super(keyring);
    this.host = host;
    this.keepkeyInstance = axios.create({
      baseURL: host,
      headers: {
        "content-type": "application/json",
        "Access-Control-Allow-Origin": host,
      },
    });
    this.debugLink = true;
  }

  public getDeviceID(): string {
    return this.host;
  }

  public getVendor(): string {
    return "KeepKey";
  }

  public async getFirmwareHash(firmware: ArrayBuffer): Promise<ArrayBuffer> {
    let hash;
    if (typeof window !== "undefined") {
      hash = await window.crypto.subtle.digest(
        {
          name: "SHA-256",
        },
        new Uint8Array(firmware) //The data you want to hash as an ArrayBuffer
      );
    } else {
      const { createHash } = require("crypto");
      hash = createHash("sha256");
      hash.update(firmware);
      return hash.digest();
    }
    return hash;
  }

  public get isOpened(): boolean {
    return true;
  }

  public async connect(): Promise<void> {
    // Start reading data from usbDevice
    this.listen();
  }

  public async disconnect(): Promise<void> {}

  public getEntropy(length: number = 64): Uint8Array {
    if (typeof window !== "undefined") {
      return window.crypto.getRandomValues(new Uint8Array(length));
    } else {
      const { randomBytes } = require("crypto");
      return randomBytes(length);
    }
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

  private async writeChunk(
    buffer: ByteBuffer,
    debugLink: boolean
  ): Promise<any> {
    const data = buffer.toHex();
    return this.keepkeyInstance.post(
      debugLink ? "/exchange/debug" : "/exchange/device",
      { data }
    );
  }

  private async readChunk(debugLink: boolean): Promise<ByteBuffer> {
    const {
      data: { data },
    } = await this.keepkeyInstance.get(
      debugLink ? "/exchange/debug" : "/exchange/device"
    );
    return Promise.resolve(ByteBuffer.fromHex(data));
  }
}
