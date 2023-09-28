import TransportWebUSB from "@ledgerhq/hw-transport-webusb";
import * as core from "@shapeshiftoss/hdwallet-core";
import * as ledger from "@shapeshiftoss/hdwallet-ledger";

import { getLedgerTransport, LedgerWebUsbTransport } from "./transport";

export const VENDOR_ID = 11415;

export class WebUSBLedgerAdapter {
  keyring: core.Keyring;

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

    try {
      this.keyring.emit(
        [e.device.manufacturerName ?? "", e.device.productName ?? "", core.Events.CONNECT],
        e.device.serialNumber
      );
    } catch (error: any) {
      this.keyring.emit(
        [e.device.manufacturerName ?? "", e.device.productName ?? "", core.Events.FAILURE],
        [e.device.serialNumber, { message: { code: error.type, ...error } }]
      );
    }
  }

  private async handleDisconnectWebUSBLedger(e: USBConnectionEvent): Promise<void> {
    if (e.device.vendorId !== VENDOR_ID) return;

    this.keyring.emit(
      [e.device.manufacturerName ?? "", e.device.productName ?? "", core.Events.DISCONNECT],
      e.device.serialNumber
    );
  }

  public get(device: USBDevice): ledger.LedgerHDWallet {
    return core.mustBeDefined(this.keyring.get<ledger.LedgerHDWallet>(device.serialNumber));
  }

  // without unique device identifiers, we should only ever have one ledger device on the keyring at a time
  public async initialize(ledgerTransport?: TransportWebUSB): Promise<number> {
    const transport = ledgerTransport ?? (await getLedgerTransport());

    const wallet = ledger.create(
      new LedgerWebUsbTransport(transport.device, transport, this.keyring) as ledger.LedgerTransport
    );

    this.keyring.add(wallet, transport.device.serialNumber);

    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<ledger.LedgerHDWallet> {
    const ledgerTransport = await getLedgerTransport();

    const device = ledgerTransport.device;

    await this.initialize(ledgerTransport);

    return core.mustBeDefined(this.keyring.get<ledger.LedgerHDWallet>(device.serialNumber));
  }
}
