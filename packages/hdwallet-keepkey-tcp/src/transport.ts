import * as core from "@shapeshiftoss/hdwallet-core";
import * as keepkey from "@shapeshiftoss/hdwallet-keepkey";
import Axios, { AxiosInstance } from "axios";

import { Config } from "./adapter";

export class TransportDelegate implements keepkey.TransportDelegate {
  readonly chunked = false;
  readonly config: Config;
  readonly supportsDebugLink = true;

  axiosInstance: AxiosInstance | null = null;
  response: Promise<Uint8Array> = Promise.resolve(new Uint8Array());
  responseDebugLink: Promise<Uint8Array> = Promise.resolve(new Uint8Array());

  constructor(config: Config) {
    this.config = {
      ...config,
      headers: {
        "content-type": "application/json",
        "Access-Control-Allow-Origin": config.baseURL,
      },
    }
  }

  async getDeviceID(): Promise<string> {
    return this.config.baseURL;
  }

  async isOpened(): Promise<boolean> {
    return !!this.axiosInstance;
  }

  async connect(): Promise<void> {
    this.axiosInstance = Axios.create(this.config);
  }

  async tryConnectDebugLink(): Promise<boolean> {
    return true;
  }

  async disconnect(): Promise<void> {
    this.axiosInstance = null;
  }

  async write(msgBuf: Uint8Array, debugLink: boolean): Promise<void> {
    const endpoint = `/raw/${debugLink ? "debug" : "device"}`;
    const responseKey = debugLink ? 'responseDebugLink' : 'response';
    const reqType = new DataView(core.toArrayBuffer(msgBuf)).getUint16(2)
    const responseExpected = !keepkey.messageTypesWithoutResponse.includes(reqType)
    this[responseKey] = this[responseKey].then(async () => {
      const out = (await core.mustBeDefined(this.axiosInstance).post(
        endpoint,
        msgBuf,
        {
          headers: { "Content-Type": "application/octet-stream" },
          responseType: "arraybuffer" // this makes axios return a Buffer, not an ArrayBuffer
        }
      )).data as Buffer;
      if (!responseExpected && out.length === 0) return out
      if (!(out.length >= 8 && out[0] === 0x23 && out[1] === 0x23 && new DataView(core.toArrayBuffer(out)).getUint32(4) === out.length - 8)) {
        throw new Error("improperly framed KK response")
      }
      return out
    })
  }

  async read(debugLink: boolean): Promise<Uint8Array> {
    const responseKey = debugLink ? 'responseDebugLink' : 'response';
    const out = this[responseKey];
    this[responseKey] = out.then(() => new Uint8Array(0));
    return await out
  }
}
