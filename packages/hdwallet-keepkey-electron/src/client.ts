import * as electron from "electron";

import {
  CONNECT,
  DISCONNECT,
  GET_DEVICE,
  GET_DEVICE_ID,
  GET_DEVICES,
  GET_TRANSPORT_DELEGATE,
  IS_OPENED,
  READ_CHUNK,
  TRY_CONNECT_DEBUG_LINK,
  WRITE_CHUNK,
} from "./utils";

export const CLIENT_TAG = "apiHDWalletKeepKeyElectronClient";

export const Client = {
  getDevices(): Promise<string[]> {
    return electron.ipcRenderer.invoke(GET_DEVICES);
  },
  getDevice(serialNumber?: string): Promise<string> {
    return electron.ipcRenderer.invoke(GET_DEVICE, serialNumber);
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
  writeChunk(handle: string, buf: Uint8Array, debugLink?: boolean): Promise<void> {
    return electron.ipcRenderer.invoke(WRITE_CHUNK, handle, buf, debugLink);
  },
  readChunk(handle: string, debugLink?: boolean): Promise<Uint8Array> {
    return electron.ipcRenderer.invoke(READ_CHUNK, handle, debugLink);
  },
  expose() {
    electron.contextBridge.exposeInMainWorld(CLIENT_TAG, Client);
  },
};
export type Client = typeof Client;
