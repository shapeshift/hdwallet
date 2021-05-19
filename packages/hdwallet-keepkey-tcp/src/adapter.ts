import * as keepkey from "@shapeshiftoss/hdwallet-keepkey";
import { AxiosRequestConfig } from "axios";

import { TransportDelegate } from "./transport";

export type Config = AxiosRequestConfig & Required<Pick<AxiosRequestConfig, "baseURL">>;

export const TCPKeepKeyAdapterDelegate = {
  async getDevice(host: string): Promise<Config> {
    return {
      baseURL: host,
    };
  },
  async getTransportDelegate(config: Config) {
    return new TransportDelegate(config);
  },
  async inspectDevice(config: Config) {
    return {
      serialNumber: config.baseURL,
    };
  },
};

export const Adapter = keepkey.Adapter.fromDelegate(TCPKeepKeyAdapterDelegate);
export const TCPKeepKeyAdapter = Adapter;
