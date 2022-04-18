import * as core from "@shapeshiftoss/hdwallet-core";

import { KeepKeyHDWallet } from "./keepkey";
import { Transport, TransportDelegate } from "./transport";

export interface AdapterConstructor<DelegateType extends AdapterDelegate<unknown>> {
  new (keyring: core.Keyring): Adapter<DelegateType>;
  useKeyring(keyring: core.Keyring): Adapter<DelegateType>;
}

export type DeviceProperties = {
  productName: string;
  serialNumber: string;
};

export interface AdapterDelegate<DeviceType> {
  inspectDevice?(device: DeviceType): Promise<Partial<DeviceProperties>>;
  getDevice?(serialNumber?: string): Promise<DeviceType>;
  getDevices?(): Promise<Array<DeviceType>>;
  getTransportDelegate(device: DeviceType): Promise<TransportDelegate | null>;
  registerCallbacks?(handleConnect: (device: DeviceType) => void, handleDisconnect: (device: DeviceType) => void): void;
}

export type DeviceType<T extends AdapterDelegate<any>> = T extends AdapterDelegate<infer R> ? R : never;

export class Adapter<DelegateType extends AdapterDelegate<any>> {
  keyring: core.Keyring;
  delegate: DelegateType;

  private constructor(keyring: core.Keyring, delegate: DelegateType) {
    this.keyring = keyring;
    this.delegate = delegate;
    try {
      this.delegate.registerCallbacks?.(this.handleConnect.bind(this), this.handleDisconnect.bind(this));
    } catch (e) {
      console.error(e);
    }
  }

  static fromDelegate<DelegateType extends AdapterDelegate<unknown>>(
    delegate: DelegateType
  ): AdapterConstructor<DelegateType> {
    const fn = (keyring: core.Keyring) => new Adapter(keyring, delegate);
    const out = fn as unknown as AdapterConstructor<DelegateType>;
    out.useKeyring = fn;
    return out;
  }

  static async inspectDevice<DelegateType extends AdapterDelegate<any>>(
    delegate: DelegateType,
    device: DeviceType<DelegateType>
  ): Promise<DeviceProperties> {
    const props =
      (await Promise.resolve(delegate.inspectDevice?.(device))) ??
      (["object", "function"].includes(typeof device) ? (device as Partial<DeviceProperties>) : {});
    if (!props.serialNumber && typeof device === "string") props.serialNumber = device;
    return {
      get productName() {
        const out = props["productName"];
        return typeof out === "string" ? out : "KeepKey";
      },
      get serialNumber() {
        const out = props["serialNumber"];
        if (typeof out !== "string") throw new Error("could not get serialNumber from device");
        return out;
      },
    };
  }

  async inspectDevice(device: DeviceType<DelegateType>): Promise<DeviceProperties> {
    return Adapter.inspectDevice(this.delegate, device);
  }

  private async handleConnect(device: DeviceType<DelegateType>): Promise<void> {
    try {
      await this.initialize([device]);
      const { productName, serialNumber } = await this.inspectDevice(device);
      await this.keyring.emit([productName, serialNumber, core.Events.CONNECT], serialNumber);
    } catch (e) {
      console.error(e);
    }
  }

  private async handleDisconnect(device: DeviceType<DelegateType>): Promise<void> {
    const { productName, serialNumber } = await this.inspectDevice(device);
    try {
      await this.keyring.remove(serialNumber);
    } catch {
      // swallow keyring removal errors
    }
    await this.keyring.emit([productName, serialNumber, core.Events.DISCONNECT], serialNumber);
  }

  async initialize(
    devices?: Array<DeviceType<DelegateType>>,
    tryDebugLink?: boolean,
    autoConnect?: boolean
  ): Promise<number> {
    devices = devices ?? (await this.getDevices());
    for (const device of devices) {
      const { serialNumber } = await this.inspectDevice(device);
      if (this.keyring.wallets[serialNumber]) await this.keyring.remove(serialNumber);

      const delegate = await this.getTransportDelegate(device);
      if (delegate === null) continue;

      const transport = await Transport.create(this.keyring, delegate);
      await transport.connect();
      if (tryDebugLink) await transport.tryConnectDebugLink();

      const wallet = await KeepKeyHDWallet.create(transport);
      if (autoConnect) await wallet.initialize();
      this.keyring.add(wallet, serialNumber);
    }
    return Object.keys(this.keyring.wallets).length;
  }

  async getDevice(serialNumber?: string): Promise<DeviceType<DelegateType>> {
    if (this.delegate.getDevice) return await this.delegate.getDevice(serialNumber);

    if (!serialNumber) throw new Error("no default device specified");
    const devices = await this.getDevices();
    return (
      (
        await Promise.all(
          devices.map(async (x) => ((await this.inspectDevice(x)).serialNumber === serialNumber ? x : null))
        )
      ).filter((x) => x !== null) as DeviceType<DelegateType>[]
    )[0];
  }

  async getDevices(): Promise<Array<DeviceType<DelegateType>>> {
    if (this.delegate.getDevices) return await this.delegate.getDevices();

    let defaultDevice: DeviceType<DelegateType> | undefined = undefined;
    try {
      defaultDevice = await this.getDevice();
    } catch {
      // swallow default device fetch errors
    }
    return defaultDevice ? [defaultDevice] : [];
  }

  async getTransportDelegate(device: DeviceType<DelegateType>): Promise<TransportDelegate | null> {
    return await this.delegate.getTransportDelegate(device);
  }

  async pairDevice(serialNumber?: string, tryDebugLink?: boolean): Promise<KeepKeyHDWallet> {
    const device = await this.getDevice(serialNumber);
    if (!device)
      throw new Error(
        serialNumber
          ? `could not find device matching serial number '${serialNumber}'`
          : "could not find default device"
      );
    return this.pairRawDevice(device, tryDebugLink);
  }

  async pairRawDevice(device: DeviceType<DelegateType>, tryDebugLink?: boolean): Promise<KeepKeyHDWallet> {
    await this.initialize([device], tryDebugLink, true);
    return core.mustBeDefined(this.keyring.get<KeepKeyHDWallet>((await this.inspectDevice(device)).serialNumber));
  }
}
