import { KeepKeyAdapter } from "@shapeshiftoss/hdwallet-keepkey";
import { TransportDelegate } from "./transport";
import { VENDOR_ID, WEBUSB_PRODUCT_ID, HID_PRODUCT_ID } from "./utils";

import { usb } from "webusb";

export const NodeWebUSBAdapterDelegate = {
  async getDevices(): Promise<USBDevice[]> {
    return (await usb.getDevices()).filter(
      (x) => x.vendorId === VENDOR_ID && [WEBUSB_PRODUCT_ID, HID_PRODUCT_ID].includes(x.productId)
    );
  },
  async getDevice(serialNumber?: string): Promise<USBDevice> {
    return await usb.requestDevice({
      filters: [
        { vendorId: VENDOR_ID, productId: WEBUSB_PRODUCT_ID, serialNumber },
        { vendorId: VENDOR_ID, productId: HID_PRODUCT_ID, serialNumber },
      ],
    });
  },
  async getTransportDelegate(device: USBDevice) {
    return new TransportDelegate(device);
  },
};

export const NodeWebUSBKeepKeyAdapter = KeepKeyAdapter.withDelegate(NodeWebUSBAdapterDelegate);
