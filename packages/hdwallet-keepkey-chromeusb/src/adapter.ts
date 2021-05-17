import { KeepKeyAdapter } from "@shapeshiftoss/hdwallet-keepkey";
import { TransportDelegate } from "./transport";
import { VENDOR_ID, WEBUSB_PRODUCT_ID, HID_PRODUCT_ID, assertChromeUSB, chromeUsb, makePromise } from "./utils";

export const ChromeUSBAdapterDelegate = {
  async getTransportDelegate(device: USBDevice) {
    return new TransportDelegate(device);
  },
  async getDevices(): Promise<USBDevice[]> {
    assertChromeUSB(chromeUsb);
    return (await makePromise(chromeUsb.getDevices, {
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
    assertChromeUSB(chromeUsb);
    chromeUsb.onDeviceAdded.addListener(handleConnect);
    chromeUsb.onDeviceRemoved.addListener(handleDisconnect);
  }
};

export const ChromeUSBAdapter = KeepKeyAdapter.withDelegate(ChromeUSBAdapterDelegate);
