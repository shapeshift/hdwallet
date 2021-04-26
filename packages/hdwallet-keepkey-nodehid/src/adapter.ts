import * as keepkey from "@shapeshiftoss/hdwallet-keepkey";
import * as hid from "node-hid";

import { Device, TransportDelegate } from "./transport";
import { VENDOR_ID, PRODUCT_ID } from "./utils";

export const HIDKeepKeyAdapterDelegate = {
  async inspectDevice(device: Device) {
    return {
      get productName() {
        return device.product;
      },
      get serialNumber() {
        return device.serialNumber;
      },
    };
  },
  async getDevices(): Promise<Device[]> {
    return (hid.devices().filter((d) => d.path !== undefined && d.serialNumber !== undefined) as Device[]).filter(
      (d) => d.vendorId === VENDOR_ID && d.productId === PRODUCT_ID
    );
  },
  async getTransportDelegate(device: Device) {
    return new TransportDelegate(device);
  },
};

export const Adapter = keepkey.Adapter.fromDelegate(HIDKeepKeyAdapterDelegate);
export const HIDKeepKeyAdapter = Adapter;
