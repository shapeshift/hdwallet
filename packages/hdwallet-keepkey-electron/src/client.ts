import { contextBridge, ipcRenderer } from "electron";
import {
  GET_DEVICE,
  GET_DEVICES,
  GET_TRANSPORT_DELEGATE,
  IS_OPENED,
  GET_DEVICE_ID,
  CONNECT,
  TRY_CONNECT_DEBUG_LINK,
  DISCONNECT,
  WRITE_CHUNK,
  READ_CHUNK,
} from "./utils";

export const CLIENT_TAG = "apiHDWalletKeepKeyElectronClient";

export const Client = {
  getDevices(): Promise<string[]> {
    return ipcRenderer.invoke(GET_DEVICES);
  },
  getDevice(serialNumber?: string): Promise<string> {
    return ipcRenderer.invoke(GET_DEVICE, serialNumber);
  },
  getTransportDelegate(handle: string): Promise<void> {
    return ipcRenderer.invoke(GET_TRANSPORT_DELEGATE, handle);
  },
  isOpened(handle: string): Promise<boolean> {
    return ipcRenderer.invoke(IS_OPENED, handle);
  },
  getDeviceID(handle: string): Promise<string> {
    return ipcRenderer.invoke(GET_DEVICE_ID, handle);
  },
  connect(handle: string): Promise<void> {
    return ipcRenderer.invoke(CONNECT, handle);
  },
  tryConnectDebugLink(handle: string): Promise<boolean> {
    return ipcRenderer.invoke(TRY_CONNECT_DEBUG_LINK, handle);
  },
  disconnect(handle: string): Promise<void> {
    return ipcRenderer.invoke(DISCONNECT, handle);
  },
  writeChunk(handle: string, buf: Uint8Array, debugLink?: boolean): Promise<void> {
    return ipcRenderer.invoke(WRITE_CHUNK, handle, buf, debugLink);
  },
  readChunk(handle: string, debugLink?: boolean): Promise<Uint8Array> {
    return ipcRenderer.invoke(READ_CHUNK, handle, debugLink);
  },
  expose() {
    contextBridge.exposeInMainWorld(CLIENT_TAG, Client);
  }
}
export type Client = typeof Client;
