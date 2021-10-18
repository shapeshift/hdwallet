import * as core from "@shapeshiftoss/hdwallet-core";
import * as ledger from "@shapeshiftoss/hdwallet-ledger";

import { LedgerWebHIDTransport, MOCK_SERIAL_NUMBER, getFirstLedgerDevice, getTransport, openTransport } from "./transport";

const VENDOR_ID = 11415;
const APP_NAVIGATION_DELAY = 3000;

export class WebHIDLedgerAdapter {
  keyring: core.Keyring;
  currentEventTimestamp: number = 0;

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
    } catch (error) {
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
      } catch (e) {
        console.error(e);
      } finally {
        this.keyring.emit(["Ledger", e.device.productName ?? "", core.Events.DISCONNECT], MOCK_SERIAL_NUMBER);
      }
    }, APP_NAVIGATION_DELAY);
  }

  public get(): core.HDWallet {
    return core.mustBeDefined(this.keyring.get(MOCK_SERIAL_NUMBER));
  }

  // without unique device identifiers, we should only ever have one ledger device on the keyring at a time
  private async initialize(device: HIDDevice): Promise<ledger.LedgerHDWallet> {
    await this.keyring.remove(core.mustBeDefined(MOCK_SERIAL_NUMBER));

    const ledgerTransport = await openTransport(device);

    const wallet = ledger.create(new LedgerWebHIDTransport(device, ledgerTransport, this.keyring) as ledger.LedgerTransport);

    await this.keyring.add(wallet, MOCK_SERIAL_NUMBER);

    return wallet
  }

  public async pairDevice(usbDevice?: HIDDevice): Promise<ledger.LedgerHDWallet> {
    const device = usbDevice ?? (await getTransport()).device ?? (await getFirstLedgerDevice());

    const wallet = await this.initialize(device);

    return core.mustBeDefined(wallet);
  }
}
