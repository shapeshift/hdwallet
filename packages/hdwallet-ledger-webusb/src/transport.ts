import Btc from "@ledgerhq/hw-app-btc";
import Eth from "@ledgerhq/hw-app-eth";
import Transport from "@ledgerhq/hw-transport";
import TransportWebUSB from "@ledgerhq/hw-transport-webusb";
import getAppAndVersion from "@ledgerhq/live-common/lib/hw/getAppAndVersion";
import getDeviceInfo from "@ledgerhq/live-common/lib/hw/getDeviceInfo";
import openApp from "@ledgerhq/live-common/lib/hw/openApp";
import * as core from "@shapeshiftoss/hdwallet-core";
import * as ledger from "@shapeshiftoss/hdwallet-ledger";
import {
  LedgerResponse,
  LedgerTransportCoinType,
  LedgerTransportMethod,
  LedgerTransportMethodName,
} from "hdwallet-ledger/src/transport";

const RECORD_CONFORMANCE_MOCKS = false;

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
    if (core.isIndexable(err) && err.name === "TransportInterfaceNotAvailable") {
      throw new core.ConflictingApp("Ledger");
    }

    throw new core.WebUSBCouldNotInitialize("Ledger", String(core.isIndexable(err) ? err.message : err));
  }
}

export async function getTransport(): Promise<TransportWebUSB> {
  if (!(window && window.navigator.usb)) throw new core.WebUSBNotAvailable();

  try {
    return (await TransportWebUSB.request()) as TransportWebUSB;
  } catch (err) {
    if (core.isIndexable(err) && err.name === "TransportInterfaceNotAvailable") {
      throw new core.ConflictingApp("Ledger");
    }

    throw new core.WebUSBCouldNotPair("Ledger", String(core.isIndexable(err) ? err.message : err));
  }
}

export function translateCoinAndMethod<T extends LedgerTransportCoinType, U extends LedgerTransportMethodName<T>>(
  transport: Transport,
  coin: T,
  method: U
): LedgerTransportMethod<T, U> {
  switch (coin) {
    case "Btc": {
      const btc = new Btc(transport);
      const methodInstance = btc[method as LedgerTransportMethodName<"Btc">].bind(btc);
      return methodInstance as LedgerTransportMethod<T, U>;
    }
    case "Eth": {
      const eth = new Eth(transport);
      const methodInstance = eth[method as LedgerTransportMethodName<"Eth">].bind(eth);
      return methodInstance as LedgerTransportMethod<T, U>;
    }
    case null: {
      switch (method) {
        case "decorateAppAPIMethods": {
          const out: LedgerTransportMethod<null, "decorateAppAPIMethods"> =
            transport.decorateAppAPIMethods.bind(transport);
          return out as LedgerTransportMethod<T, U>;
        }
        case "getAppAndVersion": {
          const out: LedgerTransportMethod<null, "getAppAndVersion"> = getAppAndVersion.bind(undefined, transport);
          return out as LedgerTransportMethod<T, U>;
        }
        case "getDeviceInfo": {
          const out: LedgerTransportMethod<null, "getDeviceInfo"> = getDeviceInfo.bind(undefined, transport);
          return out as LedgerTransportMethod<T, U>;
        }
        case "openApp": {
          const out: LedgerTransportMethod<null, "openApp"> = openApp.bind(undefined, transport);
          return out as LedgerTransportMethod<T, U>;
        }
        default: {
          throw new TypeError("method");
        }
      }
    }
    default: {
      throw new TypeError("coin");
    }
  }
}

export class LedgerWebUsbTransport extends ledger.LedgerTransport {
  device: USBDevice;

  constructor(device: USBDevice, transport: Transport, keyring: core.Keyring) {
    super(transport, keyring);
    this.device = device;
  }

  public async getDeviceID(): Promise<string> {
    return core.mustBeDefined(this.device.serialNumber);
  }

  public async call<T extends LedgerTransportCoinType, U extends LedgerTransportMethodName<T>>(
    coin: T,
    method: U,
    ...args: Parameters<LedgerTransportMethod<T, U>>
  ): Promise<LedgerResponse<T, U>> {
    this.emit(
      `ledger.${coin}.${method}.call`,
      core.makeEvent({
        message_type: method,
        from_wallet: false,
        message: {},
      })
    );

    try {
      const methodInstance: LedgerTransportMethod<T, U> = translateCoinAndMethod(this.transport, coin, method);
      const response = await methodInstance(...args);
      const result = {
        success: true,
        payload: response,
        coin,
        method,
      };

      if (RECORD_CONFORMANCE_MOCKS) {
        // May need a slight amount of cleanup on escaping `'`s.
        console.info(
          `this.memoize('${coin}', '${method}',\n  JSON.parse('${JSON.stringify(
            args
          )}'),\n  JSON.parse('${JSON.stringify(result)}'))`
        );
      }

      return result;
    } catch (e) {
      console.error(e);
      return {
        success: false,
        payload: { error: String(e) },
        coin,
        method,
      };
    }
  }
}
