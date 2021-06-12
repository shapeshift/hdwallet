import * as core from "@shapeshiftoss/hdwallet-core";
import * as keepkey from "@shapeshiftoss/hdwallet-keepkey";

import { TransportDelegate } from "./transport";
import { VENDOR_ID, WEBUSB_PRODUCT_ID, HID_PRODUCT_ID } from "./utils";

const webUSB = window?.navigator?.usb as unknown;
type WebUSB = typeof window.navigator.usb;

function assertWebUSB(webUSB: any): asserts webUSB is WebUSB {
  if (!webUSB) throw new core.WebUSBNotAvailable();
}

export const AdapterDelegate = {
  async getDevices(): Promise<USBDevice[]> {
    assertWebUSB(webUSB);
    return (await webUSB.getDevices()).filter(
      (x) => x.vendorId === VENDOR_ID && [WEBUSB_PRODUCT_ID, HID_PRODUCT_ID].includes(x.productId)
    );
  },
  async getDevice(serialNumber?: string): Promise<USBDevice> {
    assertWebUSB(webUSB);
    try {
      return await webUSB.requestDevice({
        filters: [
          { vendorId: VENDOR_ID, productId: WEBUSB_PRODUCT_ID, serialNumber },
          { vendorId: VENDOR_ID, productId: HID_PRODUCT_ID, serialNumber },
        ],
      });
    } catch (e) {
      throw new core.WebUSBCouldNotPair("KeepKey", e.message);
    }
  },
  async getTransportDelegate(device: USBDevice) {
    return new TransportDelegate(device);
  },
  registerCallbacks(handleConnect: (device: USBDevice) => void, handleDisconnect: (device: USBDevice) => void): void {
    assertWebUSB(webUSB);

    async function handleUSBEvent(connecting: boolean, e: USBConnectionEvent): Promise<void> {
      const device = e.device;
      if (device.vendorId !== VENDOR_ID) return;
      if (device.productId !== WEBUSB_PRODUCT_ID) return;
      return (connecting ? handleConnect : handleDisconnect)(device);
    }

    webUSB.addEventListener("connect", handleUSBEvent.bind(null, true));
    webUSB.addEventListener("disconnect", handleUSBEvent.bind(null, false));
  },
};

export const Adapter = keepkey.Adapter.fromDelegate(AdapterDelegate);
export const WebUSBKeepKeyAdapter = Adapter;
