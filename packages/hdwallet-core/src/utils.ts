import * as eventemitter2 from "eventemitter2";
import * as Rx from "rxjs";
import * as RxOp from "rxjs/operators";

import { BIP32Path, Coin } from "./wallet";

export type Constructor<T = {}> = new (...args: any[]) => T;

export const DEFAULT_TIMEOUT = 5000; // 5 seconds
export const LONG_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export const isArray =
  Array.isArray ||
  function (obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
  };

// These helper functions marshal hex into and out of UInt8Arrays which are consumed by protobuf js
export const fromHexString = (hexString: string) => {
  const match = hexString.match(/.{1,2}/g) || [];
  return new Uint8Array(match.map((byte) => parseInt(byte, 16)));
};

// export const toHexString = (bytes: number[]) => bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '')

export function toHexString(arr: Uint8Array): string {
  return Array.prototype.map.call(arr, (x: number) => ("00" + x.toString(16)).slice(-2)).join("");
}

// Copying this from ethers.js until their elliptic dep stops being circular
export function arrayify(value: string): Uint8Array {
  if (value === null) {
    throw new Error("cannot convert null value to array");
  } else if (typeof value !== "string") {
    throw new Error("can only convert hex strings");
  }

  let match = value.match(/^(0x)?[0-9a-fA-F]*$/);

  if (!match) {
    throw new Error("invalid hexadecimal string");
  }

  if (match[1] !== "0x") {
    throw new Error("hex string must have 0x prefix");
  }

  value = value.substring(2);
  if (value.length % 2) {
    value = "0" + value;
  }

  const result = [];
  for (let i = 0; i < value.length; i += 2) {
    result.push(parseInt(value.substr(i, 2), 16));
  }

  return new Uint8Array(result);
}

const HARDENED = 0x80000000;
export function bip32ToAddressNList(path: string): number[] {
  if (!bip32Like(path)) {
    throw new Error(`Not a bip32 path: '${path}'`);
  }
  if (/^m\//i.test(path)) {
    path = path.slice(2);
  }
  const segments = path.split("/");
  if (segments.length === 1 && segments[0] === "") return [];
  const ret = new Array(segments.length);
  for (let i = 0; i < segments.length; i++) {
    const tmp = /(\d+)([hH\']?)/.exec(segments[i]);
    if (tmp === null) {
      throw new Error("Invalid input");
    }
    ret[i] = parseInt(tmp[1], 10);
    if (ret[i] >= HARDENED) {
      throw new Error("Invalid child index");
    }
    if (tmp[2] === "h" || tmp[2] === "H" || tmp[2] === "'") {
      ret[i] += HARDENED;
    } else if (tmp[2].length !== 0) {
      throw new Error("Invalid modifier");
    }
  }
  return ret;
}

export function addressNListToBIP32(address: number[]): string {
  return `m/${address.map((num) => (num >= HARDENED ? `${num - HARDENED}'` : num)).join("/")}`;
}

export function bip32Like(path: string): boolean {
  if (path == "m/") return true;
  return /^m(((\/[0-9]+h)+|(\/[0-9]+H)+|(\/[0-9]+')*)((\/[0-9]+)*))$/.test(path);
}

export function takeFirstOfManyEvents(eventEmitter: eventemitter2.EventEmitter2, events: string[]): Rx.Observable<{}> {
  return Rx.merge(...events.map((event) => Rx.fromEvent<Event>(eventEmitter, event))).pipe(RxOp.first());
}

export function stripHexPrefix(value: string) {
  return value.replace("0x", "");
}

export function stripHexPrefixAndLower(value: string): string {
  return stripHexPrefix(value).toLowerCase();
}

export function base64toHEX(base64: string): string {
  var raw = atob(base64);
  var HEX = "";

  for (let i = 0; i < raw.length; i++) {
    var _hex = raw.charCodeAt(i).toString(16);

    HEX += _hex.length == 2 ? _hex : "0" + _hex;
  }

  return "0x" + HEX.toUpperCase();
}

// https://github.com/satoshilabs/slips/blob/master/slip-0044.md
const slip44Table = Object.freeze({
  Bitcoin: 0,
  Testnet: 1,
  BitcoinCash: 145,
  BitcoinGold: 156,
  Litecoin: 2,
  Dash: 5,
  DigiByte: 20,
  Dogecoin: 3,
  BitcoinSV: 236,
  Ethereum: 60,
  Atom: 118,
  Osmo: 118,
  Binance: 714,
  Ripple: 144,
  Eos: 194,
  Fio: 235,
  Thorchain: 931,
  Rune: 931,
  Cardano: 1815,
  Secret: 529,
  Terra: 330,
  Kava: 459,
} as const);
type Slip44ByCoin<T> = (T extends keyof typeof slip44Table ? typeof slip44Table[T] : number | undefined);
export function slip44ByCoin<T extends Coin>(coin: T): Slip44ByCoin<T> {
  return (slip44Table as any)[coin];
}

export function satsFromStr(coins: string): number {
  let index = coins.indexOf(".");
  let exponent = index > 0 ? 8 - (coins.length - index - 1) : 8;
  return Number(coins.replace(/\./g, "")) * 10 ** exponent;
}

export function hardenedPath(path: BIP32Path): BIP32Path {
  return path.filter((segment) => segment >= 0x80000000);
}

export function relativePath(path: BIP32Path): BIP32Path {
  return path.filter((segment) => segment < 0x80000000);
}

export function toArrayBuffer(x: ArrayBuffer | ArrayBufferView): ArrayBuffer {
  if (x instanceof ArrayBuffer) return x;
  return x.buffer.slice(x.byteOffset, x.byteOffset + x.byteLength);
}

export function mustBeDefined<T>(x: T): NonNullable<T> {
  if (x === null || x === undefined) throw new Error("expected a value");
  return x as NonNullable<T>;
}

// Returns a copyable object which satisfies any type constraint but produces a runtime error if
// accessed in any other way. Useful as dummy data for required parameters. (Probably a bad idea
// in production.)
export function untouchable(message: string): any {
  const out = new Proxy({}, new Proxy({}, { get(_, p) {
    return (_: any, p2: any) => {
      if (p === "get" && p2 === "valueOf") return () => out;
      throw new Error(`${String(p)}(${String(p2)}): ${message}`);
    };
  }})) as any;
  return out;
}

// Webpack 4's Buffer.concat() polyfill requires Buffer[] instead of Uint8Array[]. This is a
// kludgy compatibility hack until everything gets bumped to Webpack 5.
let needCompatibleBufferConcat: boolean | undefined = undefined;

export function checkBufferConcat(): boolean {
  if (needCompatibleBufferConcat === undefined) {
    try {
      Buffer.concat([new Uint8Array()]);
      needCompatibleBufferConcat = false;
    } catch {
      needCompatibleBufferConcat = true;
    }
  }
  return needCompatibleBufferConcat;
}

export function compatibleBufferConcat(list: Uint8Array[]): Buffer {
  if (!checkBufferConcat()) return Buffer.concat(list);
  return Buffer.concat(list.map(x => Buffer.isBuffer(x) ? x : Buffer.from(x)));
}


/**
 * Type guard for things that might have (string-keyed) properties. Useful to make
 * TypeScript happy when you want to check if an object of unknown type has a particular
 * property set.
 * @example
 * try {
 *   foo();
 * } catch (e: unknown) {
 *   // Not allowed because there's no index signature for `unknown`:
 *   // if (e.bar === "baz") return "foobar";
 *   if (isIndexable(e) && e.bar === "baz") return "foobar";
 *   throw e;
 * }
 * @example
 * isIndexable({}) === true
 * @example
 * isIndexable(() => {}) === true
 * @example
 * isIndexable(Object.create(null)) === true
 * @example
 * isIndexable(String("foo")) === true
 * @example
 * isIndexable(null) === false
 * @example
 * isIndexable(3.14) === false
 * @example
 * isIndexable("foo") === false
 */
export function isIndexable(x: unknown): x is Record<string | number | symbol, unknown> {
  return x !== null && ["object", "function"].includes(typeof x)
}
