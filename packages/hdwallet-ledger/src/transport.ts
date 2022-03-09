import type Btc from "@ledgerhq/hw-app-btc";
import type Eth from "@ledgerhq/hw-app-eth";
import type Transport from "@ledgerhq/hw-transport";
import type getAppAndVersion from "@ledgerhq/live-common/lib/hw/getAppAndVersion";
import type getDeviceInfo from "@ledgerhq/live-common/lib/hw/getDeviceInfo";
import type openApp from "@ledgerhq/live-common/lib/hw/openApp";
import * as core from "@shapeshiftoss/hdwallet-core";

type MethodsOnly<T> = {
  [k in keyof T as T[k] extends (...args: any) => any ? k : never]: T[k];
};
type UnwrapPromise<T> = T extends Promise<infer R> ? R : T;
type DefinitelyCallable<T> = T extends (...args: any) => any ? T : never;

export type LedgerTransportCoinType = null | "Btc" | "Eth";
type CurriedWithTransport<T extends (transport: Transport, ...args: any) => any> = T extends (
  transport: Transport,
  ...args: infer R
) => infer S
  ? (...args: R) => S
  : never;

type LedgerNullTransportMethodMap = {
  decorateAppAPIMethods: Transport["decorateAppAPIMethods"];
  getAppAndVersion: CurriedWithTransport<typeof getAppAndVersion>;
  getDeviceInfo: CurriedWithTransport<typeof getDeviceInfo>;
  openApp: CurriedWithTransport<typeof openApp>;
};
// The null check must be first, because null is a subtype of everything if we're not in strict mode.
type LedgerTransportMethodMap<T extends LedgerTransportCoinType> = T extends null
  ? LedgerNullTransportMethodMap
  : T extends "Btc"
  ? MethodsOnly<Btc>
  : T extends "Eth"
  ? MethodsOnly<Eth>
  : never;
export type LedgerTransportMethodName<T extends LedgerTransportCoinType> = LedgerTransportMethodMap<T> extends never
  ? never
  : Extract<keyof LedgerTransportMethodMap<T>, string>;

// Converts LedgerTransportMethodUnion<unknown, U> to LedgerTransportMethodUnionInner<LedgerTransportCoinType, U>
type LedgerTransportMethodUnion<T, U> = unknown extends T
  ? LedgerTransportMethodUnionInner<LedgerTransportCoinType, U>
  : T extends LedgerTransportCoinType
  ? LedgerTransportMethodUnionInner<T, U>
  : never;

// Converts LedgerTransportMethodUnionInner<T, unknown> to LedgerTransportMethod<T, LedgerTransportMethodName<T>>
type LedgerTransportMethodUnionInner<T, U> = T extends LedgerTransportCoinType
  ? unknown extends U
    ? LedgerTransportMethod<T, LedgerTransportMethodName<T>>
    : U extends LedgerTransportMethodName<T>
    ? LedgerTransportMethod<T, U>
    : never
  : never;

export type LedgerTransportMethod<T, U> = T extends LedgerTransportCoinType
  ? U extends LedgerTransportMethodName<T>
    ? DefinitelyCallable<LedgerTransportMethodMap<T>[U]>
    : never
  : never;

export type LedgerResponse<
  T extends LedgerTransportCoinType | unknown,
  U extends T extends unknown ? unknown : LedgerTransportMethodName<Exclude<T, unknown>>
> = {
  coin: T;
  method: U;
} & (
  | {
      success: true;
      payload: UnwrapPromise<ReturnType<LedgerTransportMethodUnion<T, U>>>;
    }
  | {
      success?: false;
      payload: { error: string };
    }
);

export abstract class LedgerTransport extends core.Transport {
  transport: Transport;

  constructor(transport: Transport, keyring: core.Keyring) {
    super(keyring);
    this.transport = transport;
  }

  public abstract call<T extends LedgerTransportCoinType, U extends LedgerTransportMethodName<T>>(
    coin: T,
    method: U,
    ...args: Parameters<LedgerTransportMethod<T, U>>
  ): Promise<LedgerResponse<T, U>>;
}
