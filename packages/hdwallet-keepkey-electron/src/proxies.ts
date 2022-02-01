import * as keepkey from "@shapeshiftoss/hdwallet-keepkey";

import { CLIENT_TAG, Client } from "./client";

function getClient(): Client {
  return ((window as any)?.[CLIENT_TAG] as Client) ?? Client;
}

export const AdapterDelegateProxy = {
  getDevices(): Promise<string[]> {
    return getClient().getDevices();
  },
  getDevice(serialNumber?: string): Promise<string> {
    return getClient().getDevice(serialNumber);
  },
  async getTransportDelegate(handle: string) {
    const client = getClient();
    const [chunked, supportsDebugLink] = await Promise.all([client.getChunked(), client.getSupportsDebugLink(), client.getTransportDelegate(handle)]);
    return new TransportDelegateProxy(chunked, handle, supportsDebugLink);
  },
};

export class TransportDelegateProxy implements keepkey.TransportDelegate {
  readonly chunked: boolean;
  readonly handle: string;
  readonly supportsDebugLink: boolean;

  constructor(chunked: boolean, handle: string, supportsDebugLink: boolean) {
    this.chunked = chunked;
    this.handle = handle;
    this.supportsDebugLink = supportsDebugLink;
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

  write(buf: Uint8Array, debugLink?: boolean): Promise<void> {
    return getClient().write(this.handle, buf, debugLink);
  }
  read(debugLink?: boolean): Promise<Uint8Array> {
    return getClient().read(this.handle, debugLink);
  }
}
