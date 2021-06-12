import * as core from "@shapeshiftoss/hdwallet-core";
import * as ledger from "@shapeshiftoss/hdwallet-ledger";

import { LedgerWebUsbTransport, getFirstLedgerDevice, getTransport, openTransport } from "./transport";

const VENDOR_ID = 11415;
const APP_NAVIGATION_DELAY = 3000;

export class WebUSBLedgerAdapter {
  keyring: core.Keyring;
  currentEventTimestamp: number = 0;

  constructor(keyring: core.Keyring) {
    this.keyring = keyring;

    if (window && window.navigator.usb) {
      window.navigator.usb.addEventListener("connect", this.handleConnectWebUSBLedger.bind(this));
      window.navigator.usb.addEventListener("disconnect", this.handleDisconnectWebUSBLedger.bind(this));
    }
  }

  public static useKeyring(keyring: core.Keyring) {
    return new WebUSBLedgerAdapter(keyring);
  }

  private async handleConnectWebUSBLedger(e: USBConnectionEvent): Promise<void> {
    if (e.device.vendorId !== VENDOR_ID) return;

    this.currentEventTimestamp = Date.now();

    try {
      await this.initialize(e.device);
      this.keyring.emit([e.device.manufacturerName, e.device.productName, core.Events.CONNECT], e.device.serialNumber);
    } catch (error) {
      this.keyring.emit(
        [e.device.manufacturerName, e.device.productName, core.Events.FAILURE],
        [e.device.serialNumber, { message: { code: error.type, ...error } }]
      );
    }
  }

  private async handleDisconnectWebUSBLedger(e: USBConnectionEvent): Promise<void> {
    if (e.device.vendorId !== VENDOR_ID) return;

    const ts = Date.now();
    this.currentEventTimestamp = ts;

    // timeout gives time to detect if it is an app navigation based disconnect/connect event
    // discard disconnect event if it is not the most recent event received
    setTimeout(async () => {
      if (ts !== this.currentEventTimestamp) return;

      try {
        await this.keyring.remove(e.device.serialNumber);
      } catch (e) {
        console.error(e);
      } finally {
        this.keyring.emit([e.device.manufacturerName, e.device.productName, core.Events.DISCONNECT], e.device.serialNumber);
      }
    }, APP_NAVIGATION_DELAY);
  }

  public get(device: USBDevice): core.HDWallet {
    return this.keyring.get((device as any).serialNumber);
  }

  // without unique device identifiers, we should only ever have one ledger device on the keyring at a time
  public async initialize(usbDevice?: USBDevice): Promise<number> {
    const device = usbDevice || (await getFirstLedgerDevice());

    if (device) {
      await this.keyring.remove(device.serialNumber);

      const ledgerTransport = await openTransport(device);

      const wallet = ledger.create(new LedgerWebUsbTransport(device, ledgerTransport, this.keyring));

      this.keyring.add(wallet, device.serialNumber);
    }

    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<core.HDWallet> {
    const ledgerTransport = await getTransport();

    const device = ledgerTransport.device;

    await this.initialize(device);

    return this.keyring.get(device.serialNumber);
  }
}
