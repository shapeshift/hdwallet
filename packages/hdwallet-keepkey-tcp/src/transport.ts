import * as core from "@shapeshiftoss/hdwallet-core";
import * as keepkey from "@shapeshiftoss/hdwallet-keepkey";
import Axios, { AxiosInstance } from "axios";

import { Config } from "./adapter";

export class TransportDelegate implements keepkey.TransportDelegate {
  config: Config;
  axiosInstance: AxiosInstance | null = null;

  constructor(config: Config) {
    this.config = {
      ...config,
      headers: {
        "content-type": "application/json",
        "Access-Control-Allow-Origin": config.baseURL,
      },
    };
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

  async writeChunk(buf: Uint8Array, debugLink: boolean): Promise<void> {
    const data = Buffer.from(buf).toString("hex");
    await core.mustBeDefined(this.axiosInstance).post(debugLink ? "/exchange/debug" : "/exchange/device", { data });
  }

  async readChunk(debugLink: boolean): Promise<Uint8Array> {
    const {
      data: { data },
    } = await core.mustBeDefined(this.axiosInstance).get(debugLink ? "/exchange/debug" : "/exchange/device");
    return Buffer.from(data, "hex");
  }
}
