import * as electron from "electron";

import {
  GET_CHUNKED,
  GET_DEVICE,
  GET_DEVICES,
  GET_SUPPORTS_DEBUG_LINK,
  GET_TRANSPORT_DELEGATE,
  IS_OPENED,
  GET_DEVICE_ID,
  CONNECT,
  TRY_CONNECT_DEBUG_LINK,
  DISCONNECT,
  WRITE,
  READ,
} from "./utils";

export const CLIENT_TAG = "apiHDWalletKeepKeyElectronClient";

export const Client = {
  getChunked(): Promise<boolean> {
    return electron.ipcRenderer.invoke(GET_CHUNKED)
  },
  getDevices(): Promise<string[]> {
    return electron.ipcRenderer.invoke(GET_DEVICES);
  },
  getDevice(serialNumber?: string): Promise<string> {
    return electron.ipcRenderer.invoke(GET_DEVICE, serialNumber);
  },
  getSupportsDebugLink(): Promise<boolean> {
    return electron.ipcRenderer.invoke(GET_SUPPORTS_DEBUG_LINK)
  },
  getTransportDelegate(handle: string): Promise<void> {
    return electron.ipcRenderer.invoke(GET_TRANSPORT_DELEGATE, handle);
  },
  isOpened(handle: string): Promise<boolean> {
    return electron.ipcRenderer.invoke(IS_OPENED, handle);
  },
  getDeviceID(handle: string): Promise<string> {
    return electron.ipcRenderer.invoke(GET_DEVICE_ID, handle);
  },
  connect(handle: string): Promise<void> {
    return electron.ipcRenderer.invoke(CONNECT, handle);
  },
  tryConnectDebugLink(handle: string): Promise<boolean> {
    return electron.ipcRenderer.invoke(TRY_CONNECT_DEBUG_LINK, handle);
  },
  disconnect(handle: string): Promise<void> {
    return electron.ipcRenderer.invoke(DISCONNECT, handle);
  },
  write(handle: string, buf: Uint8Array, debugLink?: boolean): Promise<void> {
    return electron.ipcRenderer.invoke(WRITE, handle, buf, debugLink);
  },
  read(handle: string, debugLink?: boolean): Promise<Uint8Array> {
    return electron.ipcRenderer.invoke(READ, handle, debugLink);
  },
  expose() {
    electron.contextBridge.exposeInMainWorld(CLIENT_TAG, Client);
  }
}
export type Client = typeof Client;
