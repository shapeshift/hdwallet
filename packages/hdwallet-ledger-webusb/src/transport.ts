import Btc from "@ledgerhq/hw-app-btc";
import Eth from "@ledgerhq/hw-app-eth";
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
import PQueue from "p-queue";

import { VENDOR_ID } from "./adapter";

const RECORD_CONFORMANCE_MOCKS = false;

export async function getFirstLedgerDevice(): Promise<USBDevice | null> {
  if (!(window && window.navigator.usb)) throw new core.WebUSBNotAvailable();

  const existingDevices = await TransportWebUSB.list();

  return existingDevices.length > 0
    ? existingDevices[0]
    : window.navigator.usb.requestDevice({
        filters: [{ vendorId: VENDOR_ID }],
      });
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

export const getLedgerTransport = async (): Promise<TransportWebUSB> => {
  // TODO(gomes): move all the following implementation to an actual sane getTransport
  const device = await getFirstLedgerDevice();

  if (!device) throw new Error("No device found");

  await device.open();
  if (device.configuration === null) await device.selectConfiguration(1);

  try {
    await device.reset();
  } catch (err) {
    console.warn(err);
  }

  const inyerface = device.configurations[0].interfaces.find(({ alternates }) =>
    alternates.some(({ interfaceClass }) => interfaceClass === 255)
  );

  if (!inyerface) throw new Error("No Ledger device found");

  try {
    await device.claimInterface(inyerface.interfaceNumber);
  } catch (error: any) {
    await device.close();
    console.error(error);
    throw new Error(error.message);
  }

  // TODO end - all of this should be all we need to getTransport and be moved to a non-class member, exported function to be used in other places where we get a transport

  const transport = new TransportWebUSB(device, inyerface.interfaceNumber);
  return transport;
};

export async function translateCoinAndMethod<T extends LedgerTransportCoinType, U extends LedgerTransportMethodName<T>>(
  transport: TransportWebUSB,
  coin: T,
  method: U
): Promise<LedgerTransportMethod<T, U>> {
  switch (coin) {
    case "Btc": {
      const btc = new Btc({ transport });
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
  callsQueue: PQueue;

  constructor(device: USBDevice, transport: TransportWebUSB, keyring: core.Keyring) {
    super(transport, keyring);
    this.device = device;
    this.callsQueue = new PQueue({ concurrency: 1, interval: 1000 });
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
      const response = await this.callsQueue.add(() => methodInstance(...args));
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
