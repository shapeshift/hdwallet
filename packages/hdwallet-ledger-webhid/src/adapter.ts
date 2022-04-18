import * as core from "@shapeshiftoss/hdwallet-core";
import * as ledger from "@shapeshiftoss/hdwallet-ledger";

import {
  getFirstLedgerDevice,
  getTransport,
  LedgerWebHIDTransport,
  MOCK_SERIAL_NUMBER,
  openTransport,
} from "./transport";

const VENDOR_ID = 11415;
const APP_NAVIGATION_DELAY = 3000;

export class WebHIDLedgerAdapter {
  keyring: core.Keyring;
  currentEventTimestamp = 0;

  constructor(keyring: core.Keyring) {
    this.keyring = keyring;

    if (window && window.navigator.hid) {
      window.navigator.hid.addEventListener("connect", this.handleConnectWebHIDLedger.bind(this));
      window.navigator.hid.addEventListener("disconnect", this.handleDisconnectWebHIDLedger.bind(this));
    }
  }

  public static useKeyring(keyring: core.Keyring) {
    return new WebHIDLedgerAdapter(keyring);
  }

  private async handleConnectWebHIDLedger(e: HIDConnectionEvent): Promise<void> {
    if (e.device.vendorId !== VENDOR_ID) return;

    this.currentEventTimestamp = Date.now();

    try {
      await this.initialize(e.device);
      this.keyring.emit(["Ledger", e.device.productName ?? "", core.Events.CONNECT], MOCK_SERIAL_NUMBER);
    } catch (error: any) {
      this.keyring.emit(
        ["Ledger", e.device.productName ?? "", core.Events.FAILURE],
        [MOCK_SERIAL_NUMBER, { message: { code: error.type, ...error } }]
      );
    }
  }

  private async handleDisconnectWebHIDLedger(e: HIDConnectionEvent): Promise<void> {
    if (e.device.vendorId !== VENDOR_ID) return;

    const ts = Date.now();
    this.currentEventTimestamp = ts;

    // timeout gives time to detect if it is an app navigation based disconnect/connect event
    // discard disconnect event if it is not the most recent event received
    setTimeout(async () => {
      if (ts !== this.currentEventTimestamp) return;

      try {
        await this.keyring.remove(MOCK_SERIAL_NUMBER);
      } catch (error) {
        console.error(error);
      } finally {
        this.keyring.emit(["Ledger", e.device.productName ?? "", core.Events.DISCONNECT], MOCK_SERIAL_NUMBER);
      }
    }, APP_NAVIGATION_DELAY);
  }

  public get(): ledger.LedgerHDWallet {
    return core.mustBeDefined(this.keyring.get<ledger.LedgerHDWallet>(MOCK_SERIAL_NUMBER));
  }

  // without unique device identifiers, we should only ever have one HID ledger device on the keyring at a time
  public async initialize(device?: HIDDevice): Promise<number> {
    device = device ?? (await getFirstLedgerDevice()) ?? undefined;

    if (device) {
      await this.keyring.remove(MOCK_SERIAL_NUMBER);

      const ledgerTransport = await openTransport(device);

      const wallet = ledger.create(new LedgerWebHIDTransport(device, ledgerTransport, this.keyring));

      this.keyring.add(wallet, MOCK_SERIAL_NUMBER);
    }

    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<ledger.LedgerHDWallet> {
    const ledgerTransport = await getTransport();

    const device = ledgerTransport.device;

    await this.initialize(device);

    return core.mustBeDefined(this.keyring.get<ledger.LedgerHDWallet>(MOCK_SERIAL_NUMBER));
  }
}
