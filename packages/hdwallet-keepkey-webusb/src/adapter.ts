import * as core from "@shapeshiftoss/hdwallet-core";
import * as keepkey from "@shapeshiftoss/hdwallet-keepkey";

import { Device, TransportDelegate } from "./transport";
import { HID_PRODUCT_ID, VENDOR_ID, WEBUSB_PRODUCT_ID } from "./utils";

// This avoids a prompt ReferenceError if the module is imported outside a browser.
const webUSB = typeof window === "object" && (window?.navigator?.usb as unknown);
type WebUSB = typeof window.navigator.usb;

function assertWebUSB(x: any): asserts x is WebUSB {
  if (!x) throw new core.WebUSBNotAvailable();
}

export const AdapterDelegate = {
  async getDevices(): Promise<Device[]> {
    assertWebUSB(webUSB);
    const devices = (await webUSB.getDevices()).filter((d) => d.serialNumber !== undefined) as Device[];
    return devices.filter((x) => x.vendorId === VENDOR_ID && [WEBUSB_PRODUCT_ID, HID_PRODUCT_ID].includes(x.productId));
  },
  async getDevice(serialNumber?: string): Promise<Device> {
    assertWebUSB(webUSB);
    try {
      const out = await webUSB.requestDevice({
        filters: [
          { vendorId: VENDOR_ID, productId: WEBUSB_PRODUCT_ID, serialNumber },
          { vendorId: VENDOR_ID, productId: HID_PRODUCT_ID, serialNumber },
        ],
      });
      if (out.serialNumber === undefined) throw new Error("expected serial number");
      return out as Device;
    } catch (e) {
      throw new core.WebUSBCouldNotPair("KeepKey", String(core.isIndexable(e) ? e.message : e));
    }
  },
  async getTransportDelegate(device: Device) {
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
