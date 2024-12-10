import Btc from "@ledgerhq/hw-app-btc";
import Cosmos from "@ledgerhq/hw-app-cosmos";
import Eth from "@ledgerhq/hw-app-eth";
import Solana from "@ledgerhq/hw-app-solana";
import Transport from "@ledgerhq/hw-transport";
import TransportWebUSB from "@ledgerhq/hw-transport-webusb";
import getAppAndVersion from "@ledgerhq/live-common/lib/hw/getAppAndVersion";
import getDeviceInfo from "@ledgerhq/live-common/lib/hw/getDeviceInfo";
import openApp from "@ledgerhq/live-common/lib/hw/openApp";
// Blame Ledger here, enforcing resolutions isn't enough to fix the types inconsistencies
import type LiveCommonTransport from "@ledgerhq/live-common/node_modules/@ledgerhq/hw-transport/lib/Transport";
import * as core from "@shapeshiftoss/hdwallet-core";
import { LedgerTransport, Thorchain } from "@shapeshiftoss/hdwallet-ledger";
import {
  LedgerResponse,
  LedgerTransportCoinType,
  LedgerTransportMethod,
  LedgerTransportMethodName,
} from "hdwallet-ledger/src/transport";
import PQueue from "p-queue/dist";

import { VENDOR_ID } from "./adapter";

const RECORD_CONFORMANCE_MOCKS = false;

const callsQueue = new PQueue({ concurrency: 1, interval: 1000 });

export async function getFirstLedgerDevice(): Promise<USBDevice> {
  if (!(window && window.navigator.usb)) throw new core.WebUSBNotAvailable();

  try {
    const existingDevices = await TransportWebUSB.list();

    const maybeExistingDevice = existingDevices?.[0];
    if (maybeExistingDevice) return maybeExistingDevice;

    const requestedDevice = await window.navigator.usb.requestDevice({
      filters: [{ vendorId: VENDOR_ID }],
    });

    return requestedDevice;
  } catch (err) {
    if (core.isIndexable(err) && err.name === "TransportInterfaceNotAvailable") {
      throw new core.ConflictingApp("Ledger");
    }
    throw new core.WebUSBCouldNotInitialize("Ledger", String(core.isIndexable(err) ? err.message : err));
  }
}

export const getLedgerTransport = async (): Promise<TransportWebUSB> => {
  const device = await getFirstLedgerDevice();

  if (!device) throw new Error("No device found");

  await device.open();
  if (device.configuration === null) await device.selectConfiguration(1);

  try {
    await device.reset();
  } catch (err) {
    console.warn(err);
  }

  const usbInterface = device.configurations[0].interfaces.find(({ alternates }) =>
    alternates.some(({ interfaceClass }) => interfaceClass === 255)
  );

  if (!usbInterface) throw new Error("No Ledger device found");

  try {
    await device.claimInterface(usbInterface.interfaceNumber);
  } catch (error: any) {
    await device.close();
    console.error(error);
    throw new Error(error.message);
  }

  return new TransportWebUSB(device, usbInterface.interfaceNumber);
};

export async function translateCoinAndMethod<T extends LedgerTransportCoinType, U extends LedgerTransportMethodName<T>>(
  transport: TransportWebUSB,
  coin: T,
  method: U
): Promise<LedgerTransportMethod<T, U>> {
  switch (coin) {
    case "Btc": {
      const btc = new Btc({ transport: transport as Transport });
      const methodInstance = btc[method as LedgerTransportMethodName<"Btc">].bind(btc);
      return methodInstance as LedgerTransportMethod<T, U>;
    }
    case "Eth": {
      const eth = new Eth(transport as Transport);
      const methodInstance = eth[method as LedgerTransportMethodName<"Eth">].bind(eth);
      return methodInstance as LedgerTransportMethod<T, U>;
    }
    case "Thorchain": {
      const thorchain = new Thorchain(transport as Transport);
      const methodInstance = thorchain[method as LedgerTransportMethodName<"Thorchain">].bind(thorchain);
      return methodInstance as LedgerTransportMethod<T, U>;
    }
    case "Cosmos": {
      const cosmos = new Cosmos(transport as Transport);
      const methodInstance = cosmos[method as LedgerTransportMethodName<"Cosmos">].bind(cosmos);
      return methodInstance as LedgerTransportMethod<T, U>;
    }
    case "Solana": {
      const solana = new Solana(transport as Transport);
      const methodInstance = solana[method as LedgerTransportMethodName<"Solana">].bind(solana);
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
          const out: LedgerTransportMethod<null, "getAppAndVersion"> = getAppAndVersion.bind(
            undefined,
            transport as LiveCommonTransport
          );
          return out as LedgerTransportMethod<T, U>;
        }
        case "getDeviceInfo": {
          const out: LedgerTransportMethod<null, "getDeviceInfo"> = getDeviceInfo.bind(
            undefined,
            transport as LiveCommonTransport
          );
          return out as LedgerTransportMethod<T, U>;
        }
        case "openApp": {
          const out: LedgerTransportMethod<null, "openApp"> = openApp.bind(undefined, transport as LiveCommonTransport);
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

export class LedgerWebUsbTransport extends LedgerTransport {
  device: USBDevice;

  constructor(device: USBDevice, transport: TransportWebUSB, keyring: core.Keyring) {
    super(transport as LiveCommonTransport, keyring);
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
      const transport = await getLedgerTransport();
      const methodInstance: LedgerTransportMethod<T, U> = await translateCoinAndMethod(transport, coin, method);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore ts is drunk, stop pls
      const response = await callsQueue.add(() => methodInstance(...args));
      await transport.close();
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

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore ts is drunk, stop pls
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
