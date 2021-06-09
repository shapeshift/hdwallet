import TransportU2F from "@ledgerhq/hw-transport-u2f";
import * as core from "@shapeshiftoss/hdwallet-core";
import * as ledger from "@shapeshiftoss/hdwallet-ledger";

import { LedgerU2FTransport } from "./transport";

const VENDOR_ID = 11415;

export class U2FLedgerAdapter {
  keyring: core.Keyring;

  constructor(keyring: core.Keyring) {
    this.keyring = keyring;
  }

  public static useKeyring(keyring: core.Keyring) {
    return new U2FLedgerAdapter(keyring);
  }

  public get(device: any): core.HDWallet | null {
    return this.keyring.get(device.deviceID);
  }

  public async initialize(devices?: any[]): Promise<number> {
    const devicesToInitialize = devices || [];

    for (let i = 0; i < devicesToInitialize.length; i++) {
      const device = devicesToInitialize[i];

      if (device.vendorId !== VENDOR_ID) {
        continue;
      }

      // remove last connected ledger from keyring since we don't have unique identifier
      if (!device.deviceID) {
        device.deviceID = "u2f-ledger";
        await this.keyring.remove(device.deviceID);
      }

      if (this.keyring.wallets[device.deviceID]) {
        continue;
      }

      const ledgerTransport = await TransportU2F.open();

      const wallet = ledger.create(new LedgerU2FTransport(device, ledgerTransport, this.keyring));

      this.keyring.add(wallet, device.deviceID);
      this.keyring.emit(["Ledger", device.deviceID, core.Events.CONNECT], device.deviceID);
    }

    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<core.HDWallet> {
    const transport = await TransportU2F.open();

    const device = transport.device;

    await this.initialize([device]);

    return core.mustBeDefined(this.keyring.get(device.deviceID));
  }
}
