import * as keepkey from "@shapeshiftoss/hdwallet-keepkey";

import { Client, CLIENT_TAG } from "./client";

function getClient(): Client {
  return ((window as any)?.[CLIENT_TAG] as Client) ?? Client;
}

export class TransportDelegateProxy implements keepkey.TransportDelegate {
  handle: string;
  constructor(handle: string) {
    this.handle = handle;
  }

  isOpened(): Promise<boolean> {
    return getClient().isOpened(this.handle);
  }
  getDeviceID(): Promise<string> {
    return getClient().getDeviceID(this.handle);
  }

  connect(): Promise<void> {
    return getClient().connect(this.handle);
  }
  tryConnectDebugLink(): Promise<boolean> {
    return getClient().tryConnectDebugLink(this.handle);
  }
  disconnect(): Promise<void> {
    return getClient().disconnect(this.handle);
  }

  writeChunk(buf: Uint8Array, debugLink?: boolean): Promise<void> {
    return getClient().writeChunk(this.handle, buf, debugLink);
  }
  readChunk(debugLink?: boolean): Promise<Uint8Array> {
    return getClient().readChunk(this.handle, debugLink);
  }
}

export const AdapterDelegateProxy = {
  getDevices(): Promise<string[]> {
    return getClient().getDevices();
  },
  getDevice(serialNumber?: string): Promise<string> {
    return getClient().getDevice(serialNumber);
  },
  async getTransportDelegate(handle: string) {
    await getClient().getTransportDelegate(handle);
    return new TransportDelegateProxy(handle);
  },
};
