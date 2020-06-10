import { create as createLedger } from "@shapeshiftoss/hdwallet-ledger";
import { Events, Keyring, HDWallet } from "@shapeshiftoss/hdwallet-core";
import { LedgerU2FTransport } from "./transport";
import TransportU2F from "@ledgerhq/hw-transport-u2f";

const VENDOR_ID = 11415;

export class U2FLedgerAdapter {
  keyring: Keyring;

  constructor(keyring: Keyring) {
    this.keyring = keyring;
  }

  public static useKeyring(keyring: Keyring) {
    return new U2FLedgerAdapter(keyring);
  }

  public get(device: any): HDWallet {
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

      const wallet = createLedger(
        new LedgerU2FTransport(device, ledgerTransport, this.keyring)
      );

      this.keyring.add(wallet, device.deviceID);
      this.keyring.emit(
        ["Ledger", device.deviceID, Events.CONNECT],
        device.deviceID
      );
    }

    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<HDWallet> {
    const transport = await TransportU2F.open();

    const device = transport.device;

    await this.initialize([device]);

    return this.keyring.get(device.deviceID);
  }
}
