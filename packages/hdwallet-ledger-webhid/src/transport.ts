import Btc from "@ledgerhq/hw-app-btc";
import Eth from "@ledgerhq/hw-app-eth";
import Transport from "@ledgerhq/hw-transport";
import TransportWebHID from "@ledgerhq/hw-transport-webhid";
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

export const MOCK_SERIAL_NUMBER = "ledger-webhid-device"; // WebHID devices do not have serialNumbers

export async function getFirstLedgerDevice(): Promise<HIDDevice | null> {
  if (!(window && window.navigator.hid)) throw new core.WebHIDNotAvailable();

  const existingDevices = await TransportWebHID.list();

  return existingDevices.length > 0 ? existingDevices[0] : null;
}

export async function openTransport(device: HIDDevice): Promise<TransportWebHID> {
  if (!(window && window.navigator.hid)) throw new core.WebHIDNotAvailable();

  try {
    return await TransportWebHID.open(device);
  } catch (err) {
    if (core.isIndexable(err) && err.name === "TransportInterfaceNotAvailable") {
      throw new core.ConflictingApp("Ledger");
    }

    throw new core.WebHIDCouldNotInitialize("Ledger", String(core.isIndexable(err) ? err.message : err));
  }
}

export async function getTransport(): Promise<TransportWebHID> {
  if (!(window && window.navigator.hid)) throw new core.WebHIDNotAvailable();

  try {
    return (await TransportWebHID.request()) as TransportWebHID;
  } catch (err) {
    if (core.isIndexable(err) && err.name === "TransportInterfaceNotAvailable") {
      throw new core.ConflictingApp("Ledger");
    }

    throw new core.WebHIDCouldNotPair("Ledger", String(core.isIndexable(err) ? err.message : err));
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

export class LedgerWebHIDTransport extends ledger.LedgerTransport {
  device: HIDDevice;

  constructor(device: HIDDevice, transport: Transport, keyring: core.Keyring) {
    super(transport, keyring);
    this.device = device;
  }

  // WebHID has no device.serialNumber. Use "0001" for Ledger WebUSBDevices and "0002" for Ledger WebHIDDevices
  public async getDeviceID(): Promise<string> {
    return MOCK_SERIAL_NUMBER;
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
