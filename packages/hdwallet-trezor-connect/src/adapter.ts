import * as core from "@shapeshiftoss/hdwallet-core";
import * as trezor from "@shapeshiftoss/hdwallet-trezor";
import TrezorConnect, { DEVICE, DEVICE_EVENT, TRANSPORT_EVENT, UI } from "trezor-connect";

import { POPUP, TrezorConnectTransport, TrezorDevice } from "./transport";

export type DeviceID = string;

export type TrezorConnectArgs = {
  debug: boolean;
  manifest: {
    appUrl: string;
    email: string;
  };
};

let _initialization: undefined | Promise<boolean> = undefined;

export class TrezorAdapter {
  keyring: core.Keyring;

  private _deviceIDToPath = new Map();

  private constructor(keyring: core.Keyring, args: TrezorConnectArgs) {
    this.keyring = keyring;

    if (!_initialization) _initialization = this.connectInit(args);
  }

  private async connectInit(args: TrezorConnectArgs): Promise<boolean> {
    // Collect connect events that happen during init, but don't handle them
    // until after init has resolved. This awkward sequence is needed because we
    // need TrezorConnect to be fully operational before we're able to process
    // the events.
    const connectEvents: any[] = [];
    const connectHandler = (event: any) => {
      if (event.type === DEVICE.CONNECT) {
        connectEvents.push(event);
      }
    };
    TrezorConnect.on(DEVICE_EVENT, connectHandler);

    // TODO: using this in electron will needs some more scaffolding:
    // https://github.com/szymonlesisz/trezor-connect-electron-boilerplate/blob/master/src/electron.js
    await TrezorConnect.init({
      ...args,
      popup: POPUP,
      lazyLoad: false,
    });

    TrezorConnect.off(DEVICE_EVENT, connectHandler);

    for (const connectEvent of connectEvents) this.handleConnectTrezor(connectEvent);

    TrezorConnect.on(DEVICE_EVENT, (event: any) => {
      if (event.type === DEVICE.CONNECT) {
        this.handleConnectTrezor(event);
      } else if (event.type === DEVICE.CHANGED) {
        this.handleChangeTrezor(event);
      } else if (event.type === DEVICE.DISCONNECT) {
        this.handleDisconnectTrezor(event);
      }
    });

    TrezorConnect.on(TRANSPORT_EVENT, (event: any) => {
      // Log TrezorConnect's event raw:
      try {
        const device_id = event.payload && event.payload.features ? event.payload.features.device_id : "";
        this.keyring.emit(["Trezor", device_id, event.type], event);
      } catch (e) {
        console.error("Could not emit Trezor transport event", event, e);
      }
    });

    TrezorConnect.on(UI.ADDRESS_VALIDATION, (event: any) => {
      console.info("Confirm on Trezor", event);
    });

    return true;
  }

  public async addDevice(deviceID: string, path: string): Promise<void> {
    this._deviceIDToPath.set(deviceID, path);
    await this.initialize([{ path: path, deviceID: deviceID }]);
  }

  public static useKeyring(keyring: core.Keyring, args: TrezorConnectArgs) {
    return new TrezorAdapter(keyring, args);
  }

  public get(device: TrezorDevice): core.HDWallet | null {
    return this.keyring.get(device.deviceID);
  }

  private async handleConnectTrezor(event: any): Promise<void> {
    const {
      payload: {
        path,
        features: { device_id },
      },
    } = event;
    try {
      await this.addDevice(device_id, path);
      this.connectCacheFeatures(event);
      this.keyring.emit(["Trezor", device_id, core.Events.CONNECT], device_id);
    } catch (e) {
      console.error(e);
    }
  }

  private async handleDisconnectTrezor(event: any): Promise<void> {
    const {
      payload: {
        features: { device_id },
      },
    } = event;
    try {
      await this.keyring.remove(device_id);
    } catch (e) {
      console.error(e);
    } finally {
      this.keyring.emit(["Trezor", device_id, core.Events.DISCONNECT], device_id);
    }
  }

  /**
   * Help the wallet by cacheing the Features object whenever TrezorConnect
   * tells us about it, so we don't have to invoke the TrezorConnect popup as
   * often.
   */
  private connectCacheFeatures(event: any): void {
    const {
      payload: { features },
    } = event;
    if (!features) return;
    const wallet = this.keyring.get(features.device_id) as trezor.TrezorHDWallet;
    if (!wallet) return;

    wallet.cacheFeatures(features);
  }

  private async handleChangeTrezor(event: any): Promise<void> {
    this.connectCacheFeatures(event);
  }

  public async initialize(devices?: TrezorDevice[]): Promise<number> {
    const init = await _initialization;
    if (!init) throw new Error("Could not initialize TrezorAdapter: TrezorConnect not initialized");

    const devicesToInitialize = devices || [];

    for (let i = 0; i < devicesToInitialize.length; i++) {
      const device = devicesToInitialize[i];
      let wallet = this.keyring.get(device.deviceID);
      if (wallet) {
        if (device.path && !(wallet.transport as TrezorConnectTransport).device.path)
          (wallet.transport as TrezorConnectTransport).device.path = device.path;
      } else {
        wallet = trezor.create(new TrezorConnectTransport(device, this.keyring));
      }

      await wallet.initialize();
      this.keyring.add(wallet, device.deviceID);
    }
    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<trezor.TrezorHDWallet> {
    const init = await _initialization;
    if (!init) throw new Error("Could not pair Trezor: TrezorConnect not initialized");

    const { success, payload } = await TrezorConnectTransport.callQuiet(undefined, "getFeatures", {});

    if (!success) {
      if (payload.error === "Popup closed") throw new core.PopupClosedError();
      throw new Error(`Could not pair Trezor: '${payload.error}'`);
    }

    const deviceID = payload.device_id;

    await this.initialize([
      {
        path: this._deviceIDToPath.get(deviceID),
        deviceID: deviceID,
      },
    ]);

    const wallet = this.keyring.get(deviceID) as trezor.TrezorHDWallet;

    if (wallet) wallet.cacheFeatures(payload);

    return wallet;
  }
}
