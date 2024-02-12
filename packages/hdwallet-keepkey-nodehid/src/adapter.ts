import * as keepkey from "@shapeshiftoss/hdwallet-keepkey";
import * as hid from "node-hid";

import { Device, TransportDelegate } from "./transport";
import { PRODUCT_ID, VENDOR_ID } from "./utils";

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
  async getDevice(serialNumber?: string): Promise<Device> {
    const out = (await this.getDevices()).find(
      serialNumber !== undefined ? (x) => x.serialNumber === serialNumber : () => true
    );
    if (!out) throw new Error("device not found");
    return out;
  },
  async getTransportDelegate(device: Device) {
    return new TransportDelegate(device);
  },
};

export const Adapter = keepkey.Adapter.fromDelegate(HIDKeepKeyAdapterDelegate);
export const HIDKeepKeyAdapter = Adapter;
