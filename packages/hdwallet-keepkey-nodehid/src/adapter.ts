import { KeepKeyAdapter } from "@shapeshiftoss/hdwallet-keepkey";
import * as HID from "node-hid";
import { TransportDelegate } from "./transport";
import { VENDOR_ID, PRODUCT_ID } from "./utils";

export const HIDKeepKeyAdapterDelegate = {
  async inspectDevice(device: HID.Device) {
    return {
      get productName() {
        return device.product;
      },
      get serialNumber() {
        return device.serialNumber;
      },
    };
  },
  async getDevices(): Promise<HID.Device[]> {
    return HID.devices().filter((d) => d.vendorId === VENDOR_ID && d.productId === PRODUCT_ID);
  },
  async getTransportDelegate(device: HID.Device) {
    return new TransportDelegate(device);
  },
};

export const HIDKeepKeyAdapter = KeepKeyAdapter.withDelegate(HIDKeepKeyAdapterDelegate);
