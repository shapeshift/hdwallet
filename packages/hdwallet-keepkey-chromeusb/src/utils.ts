export const VENDOR_ID = 0x2b24;
export const WEBUSB_PRODUCT_ID = 0x0002;
export const HID_PRODUCT_ID = 0x0001;

export function makePromise(func: Function, ...args: any[]): Promise<any> {
  return new Promise((resolve) => {
    func(...args, resolve);
  });
}

declare const chrome: any;
export const chromeUsb = chrome?.["usb"] as unknown
export type ChromeUsb = {
  onDeviceAdded: { addListener: Function },
  onDeviceRemoved: { addListener: Function },
  getDevices: any,
}

export function assertChromeUSB(c: any): asserts c is ChromeUsb {
  if (!c) throw new Error("ChromeUSB is not available in this process. This package is intended for Chrome apps and extensions.");
}
