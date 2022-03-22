import * as keepkey from "@shapeshiftoss/hdwallet-keepkey";
import * as electron from "electron";
import * as uuid from "uuid";

import { GET_DEVICE, GET_DEVICES, GET_TRANSPORT_DELEGATE, PREFIX } from "./utils";

export class Server<DeviceType extends object, DelegateType extends keepkey.AdapterDelegate<DeviceType>> {
  delegate: DelegateType;
  devices: Map<string, DeviceType> = new Map();
  handles: WeakMap<DeviceType, string> = new WeakMap();
  delegates: WeakMap<DeviceType, keepkey.TransportDelegate> = new WeakMap();

  constructor(delegate: DelegateType) {
    this.delegate = delegate;
  }

  private getHandleForDevice(device: DeviceType): string {
    let out = this.handles.get(device);
    if (out === undefined) {
      out = uuid.v4();
      this.handles.set(device, out);
      this.devices.set(out, device);
    }
    return out;
  }

  private async getDevices(): Promise<string[]> {
    if (this.delegate.getDevices === undefined) throw new Error("not supported by this delegate");
    return (await this.delegate.getDevices()).map((x: DeviceType) => this.getHandleForDevice(x));
  }

  private async getDevice(serialNumber?: string): Promise<string> {
    if (this.delegate.getDevice === undefined) throw new Error("not supported by this delegate");
    return this.getHandleForDevice(await this.delegate.getDevice(serialNumber));
  }

  private async getTransportDelegate(handle: string) {
    const device = this.devices.get(handle);
    if (!device) throw new Error("invalid device handle");
    const delegate = await this.delegate.getTransportDelegate(device);
    if (delegate !== null) this.delegates.set(device, delegate);
    return delegate;
  }

  listen() {
    if (this.delegate.getDevice !== undefined)
      electron.ipcMain.handle(GET_DEVICE, (_, serialNumber?: string) => this.getDevice(serialNumber));
    if (this.delegate.getDevices !== undefined) electron.ipcMain.handle(GET_DEVICES, () => this.getDevices());
    electron.ipcMain.handle(GET_TRANSPORT_DELEGATE, (_, handle: string) => this.getTransportDelegate(handle));
    for (const delegateMethod of [
      "isOpened",
      "getDeviceID",
      "connect",
      "disconnect",
      "tryConnectDebugLink",
      "disconnect",
      "writeChunk",
      "readChunk",
    ] as const) {
      electron.ipcMain.handle(
        `${PREFIX}:${delegateMethod}`,
        async (_, handle: string, ...args: any[]): Promise<any> => {
          const device = this.devices.get(handle);
          if (!device) throw new Error("invalid device handle");
          const delegate = this.delegates.get(device);
          if (!delegate) throw new Error("no delegate for device");
          switch (delegateMethod) {
            case "tryConnectDebugLink":
              if (delegate.tryConnectDebugLink === undefined) return false;
              return await delegate.tryConnectDebugLink();
            default:
              // eslint-disable-next-line @typescript-eslint/no-shadow
              return await (delegate[delegateMethod] as (...args: any[]) => Promise<any>)(...args);
          }
        }
      );
    }
  }
}
