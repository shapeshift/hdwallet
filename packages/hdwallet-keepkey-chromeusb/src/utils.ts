export const VENDOR_ID = 0x2b24;
export const WEBUSB_PRODUCT_ID = 0x0002;
export const HID_PRODUCT_ID = 0x0001;

export function makePromise(func: (...fnArgs: any) => unknown, ...args: any[]): Promise<any> {
  return new Promise((resolve) => {
    func(...args, resolve);
  });
}

declare const chrome: any;
export const chromeUSB = chrome?.["usb"] as unknown;
export type ChromeUSB = {
  openDevice: any;
  // eslint-disable-next-line @typescript-eslint/ban-types
  onDeviceAdded: { addListener: Function };
  // eslint-disable-next-line @typescript-eslint/ban-types
  onDeviceRemoved: { addListener: Function };
  getDevices: any;
  closeDevice: any;
  setConfiguration: any;
  claimInterface: any;
  interruptTransfer: any;
};

export function assertChromeUSB(c: any): asserts c is ChromeUSB {
  if (!c)
    throw new Error(
      "ChromeUSB is not available in this process. This package is intended for Chrome apps and extensions."
    );
}
