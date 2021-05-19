import Btc from "@ledgerhq/hw-app-btc";
import Eth from "@ledgerhq/hw-app-eth";
import getAppAndVersion from "@ledgerhq/live-common/lib/hw/getAppAndVersion";
import getDeviceInfo from "@ledgerhq/live-common/lib/hw/getDeviceInfo";
import openApp from "@ledgerhq/live-common/lib/hw/openApp";
import * as core from "@shapeshiftoss/hdwallet-core";
import * as ledger from "@shapeshiftoss/hdwallet-ledger";

const RECORD_CONFORMANCE_MOCKS = false;

function translateCoin(coin: string): (any) => void {
  return {
    Btc: Btc,
    Eth: Eth,
  }[coin];
}

function translateMethod(method: string): (any) => void {
  return {
    getAppAndVersion: getAppAndVersion,
    getDeviceInfo: getDeviceInfo,
    openApp: openApp,
  }[method];
}

export class LedgerU2FTransport extends ledger.LedgerTransport {
  device: any;

  constructor(device: any, transport: any, keyring: core.Keyring) {
    super(transport, keyring);
    this.device = device;
  }

  public async getDeviceID(): Promise<string> {
    return (this.device as any).deviceID;
  }

  public async call(coin: string, method: string, ...args: any[]): Promise<ledger.LedgerResponse> {
    let response;

    try {
      this.emit(
        `ledger.${coin}.${method}.call`,
        core.makeEvent({
          message_type: method,
          from_wallet: false,
          message: {},
        })
      );

      if (coin) {
        response = await new (translateCoin(coin))(this.transport)[method](...args);
      } else {
        // @ts-ignore
        response = await translateMethod(method)(this.transport, ...args);
      }
    } catch (e) {
      console.error(e);
      return {
        success: false,
        payload: { error: e.toString() },
        coin,
        method,
      };
    }

    let result = {
      success: true,
      payload: response,
      coin,
      method,
    };

    if (RECORD_CONFORMANCE_MOCKS) {
      // May need a slight amount of cleanup on escaping `'`s.
      console.log(
        `this.memoize('${coin}', '${method}',\n  JSON.parse('${JSON.stringify(args)}'),\n  JSON.parse('${JSON.stringify(
          result
        )}'))`
      );
    }

    return result;
  }
}
