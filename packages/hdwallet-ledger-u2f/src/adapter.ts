import { create as createLedger } from '@shapeshift/hdwallet-ledger'
import { Events, Keyring, HDWallet } from '@shapeshift/hdwallet-core'
import { LedgerDevice, LedgerU2FTransport } from './transport'
import TransportU2F from '@ledgerhq/hw-transport-u2f'

export type DeviceID = string

export class U2FLedgerAdapter {
  keyring: Keyring

  private static _deviceIDToPath = new Map()

  constructor(keyring: Keyring) {
    this.keyring = keyring
  }

  public static useKeyring(keyring: Keyring) {
    return new U2FLedgerAdapter(keyring)
  }

  public async addDevice (deviceID: string, path: string): Promise<void> {
    U2FLedgerAdapter._deviceIDToPath.set(deviceID, path)
    await this.initialize([{ path, deviceID }])
  }

  public get (device: LedgerDevice): HDWallet {
    return this.keyring.get(device.deviceID)
  }

  public static newDeviceID (): string {
    // Ledger doesn't have deviceID, so we have to invent ephemeral ones.
    return 'u2f#' + Object.keys(U2FLedgerAdapter._deviceIDToPath).length.toString()
  }

  public async initialize (devices?: LedgerDevice[]): Promise<number> {
    const devicesToInitialize = devices || []

    for (let i = 0; i < devicesToInitialize.length; i++) {
      const device = devicesToInitialize[i]
      if (this.keyring.wallets[device.deviceID]) {
        await this.keyring.remove(device.deviceID)
      }

      const deviceID = U2FLedgerAdapter.newDeviceID()

      let ledgerTransport = await TransportU2F.create()
      let transport = new LedgerU2FTransport(device.deviceID, ledgerTransport, this.keyring)

      let wallet = createLedger(transport)
      this.keyring.add(wallet, deviceID)
      this.keyring.emit(["Ledger", device.deviceID, Events.CONNECT], deviceID)
    }
    return Object.keys(this.keyring.wallets).length
  }

  public async pairDevice (): Promise<HDWallet> {
    const deviceID = U2FLedgerAdapter.newDeviceID()
    let ledgerTransport = await TransportU2F.create()
    const transport = await new LedgerU2FTransport(deviceID, ledgerTransport, this.keyring)

    let wallet = createLedger(transport)
    this.keyring.add(wallet, deviceID)
    this.keyring.emit(["Ledger", deviceID, Events.CONNECT], deviceID)

    return wallet
  }
}
