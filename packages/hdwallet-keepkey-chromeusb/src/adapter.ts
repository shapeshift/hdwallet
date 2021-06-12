import * as keepkey from "@shapeshiftoss/hdwallet-keepkey";

import { TransportDelegate } from "./transport";
import { VENDOR_ID, WEBUSB_PRODUCT_ID, HID_PRODUCT_ID, assertChromeUSB, chromeUSB, makePromise } from "./utils";

export const ChromeUSBAdapterDelegate = {
  async getTransportDelegate(device: USBDevice) {
    return new TransportDelegate(device);
  },
  async getDevices(): Promise<USBDevice[]> {
    assertChromeUSB(chromeUSB);
    return (await makePromise(chromeUSB.getDevices, {
      filters: [
        {
          vendorId: VENDOR_ID,
          productId: WEBUSB_PRODUCT_ID,
        },
        {
          vendorId: VENDOR_ID,
          productId: HID_PRODUCT_ID,
        },
      ],
    })) as USBDevice[];
  },
  registerCallbacks(
    handleConnect: (device: USBDevice) => void,
    handleDisconnect: (device: USBDevice) => void
  ) {
    assertChromeUSB(chromeUSB);
    chromeUSB.onDeviceAdded.addListener(handleConnect);
    chromeUSB.onDeviceRemoved.addListener(handleDisconnect);
  }
};

export const Adapter = keepkey.Adapter.fromDelegate(ChromeUSBAdapterDelegate);
export const ChromeUSBAdapter = Adapter;
