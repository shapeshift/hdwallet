import Btc from "@ledgerhq/hw-app-btc";
import Eth from "@ledgerhq/hw-app-eth";
import Transport from "@ledgerhq/hw-transport";
import TransportWebUSB from "@ledgerhq/hw-transport-webusb";
import getAppAndVersion from "@ledgerhq/live-common/lib/hw/getAppAndVersion";
import getDeviceInfo from "@ledgerhq/live-common/lib/hw/getDeviceInfo";
import openApp from "@ledgerhq/live-common/lib/hw/openApp";
import * as core from "@shapeshiftoss/hdwallet-core";
import * as ledger from "@shapeshiftoss/hdwallet-ledger";

const RECORD_CONFORMANCE_MOCKS = false;

function translateCoin(coin: string): { new (transport: Transport): Record<string, (...args: any[]) => unknown> } {
  return core.mustBeDefined(({
    Btc: Btc,
    Eth: Eth,
  } as any)[coin]);
}

function translateMethod(method: string): (transport: Transport, ...args: any[]) => unknown {
  return core.mustBeDefined(({
    getAppAndVersion: getAppAndVersion,
    getDeviceInfo: getDeviceInfo,
    openApp: openApp,
  } as any)[method]);
}

export async function getFirstLedgerDevice(): Promise<USBDevice | null> {
  if (!(window && window.navigator.usb)) throw new core.WebUSBNotAvailable();

  const existingDevices = await TransportWebUSB.list();

  return existingDevices.length > 0 ? existingDevices[0] : null;
}

export async function openTransport(device: USBDevice): Promise<TransportWebUSB> {
  if (!(window && window.navigator.usb)) throw new core.WebUSBNotAvailable();

  try {
    return await TransportWebUSB.open(device);
  } catch (err) {
    if (err.name === "TransportInterfaceNotAvailable") {
      throw new core.ConflictingApp("Ledger");
    }

    throw new core.WebUSBCouldNotInitialize("Ledger", err.message);
  }
}

export async function getTransport(): Promise<TransportWebUSB> {
  if (!(window && window.navigator.usb)) throw new core.WebUSBNotAvailable();

  try {
    return await TransportWebUSB.request();
  } catch (err) {
    if (err.name === "TransportInterfaceNotAvailable") {
      throw new core.ConflictingApp("Ledger");
    }

    throw new core.WebUSBCouldNotPair("Ledger", err.message);
  }
}

export class LedgerWebUsbTransport extends ledger.LedgerTransport {
  device: USBDevice;

  constructor(device: USBDevice, transport: Transport, keyring: core.Keyring) {
    super(transport, keyring);
    this.device = device;
  }

  public async getDeviceID(): Promise<string> {
    return (this.device as any).deviceID;
  }

  public async call(coin: string, method: string, ...args: any[]): Promise<ledger.LedgerResponse> {
    let response: unknown;

    try {
      this.emit(
        `ledger.${coin}.${method}.call`,
        core.makeEvent({
          message_type: method,
          from_wallet: false,
          message: {},
        })
      );

      if (coin) {
        response = await new (translateCoin(coin))(this.transport)[method](...args);
      } else {
        response = await translateMethod(method)(this.transport, ...args);
      }
    } catch (e) {
      console.error(e);
      return {
        success: false,
        payload: { error: e.toString() },
        coin,
        method,
      };
    }

    let result = {
      success: true,
      payload: response,
      coin,
      method,
    };

    if (RECORD_CONFORMANCE_MOCKS) {
      // May need a slight amount of cleanup on escaping `'`s.
      console.log(
        `this.memoize('${coin}', '${method}',\n  JSON.parse('${JSON.stringify(args)}'),\n  JSON.parse('${JSON.stringify(
          result
        )}'))`
      );
    }

    return result;
  }
}
