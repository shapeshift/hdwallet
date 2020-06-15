import * as core from "@shapeshiftoss/hdwallet-core";

const supportedCoins = ["Bitcoin"];

export function MixinNativeBTCWalletInfo<TBase extends core.Constructor>(
  Base: TBase
) {
  return class MixinNativeBTCWalletInfo extends Base
    implements core.BTCWalletInfo {
    _supportsBTCInfo = true;

    btcSupportsCoin(coin: core.Coin): Promise<boolean> {
      return Promise.resolve(supportedCoins.includes(coin));
    }

    btcSupportsScriptType(
      coin: core.Coin,
      scriptType: core.BTCInputScriptType
    ): Promise<boolean> {
      if (!this.btcSupportsCoin(coin)) return Promise.resolve(false);

      switch (scriptType) {
        case core.BTCInputScriptType.SpendAddress:
        case core.BTCInputScriptType.SpendWitness:
        case core.BTCInputScriptType.SpendP2SHWitness:
          return Promise.resolve(true);
        default:
          return Promise.resolve(false);
      }
    }

    btcSupportsSecureTransfer(): Promise<boolean> {
      return Promise.resolve(false);
    }

    btcSupportsNativeShapeShift(): boolean {
      return false;
    }

    btcGetAccountPaths(
      msg: core.BTCGetAccountPaths
    ): Array<core.BTCAccountPath> {
      const slip44 = core.slip44ByCoin(msg.coin);
      const bip44 = core.legacyAccount(msg.coin, slip44, msg.accountIdx);
      const bip49 = core.segwitAccount(msg.coin, slip44, msg.accountIdx);
      const bip84 = core.segwitNativeAccount(msg.coin, slip44, msg.accountIdx);

      const coinPaths = {
        Bitcoin: [bip44, bip49, bip84],
      };

      let paths: Array<core.BTCAccountPath> = coinPaths[msg.coin] || [];

      if (msg.scriptType !== undefined) {
        paths = paths.filter((path) => {
          return path.scriptType === msg.scriptType;
        });
      }

      return paths;
    }

    btcIsSameAccount(msg: Array<core.BTCAccountPath>): boolean {
      // TODO: support at some point
      return false;
    }

    btcNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath {
      const description = core.describeUTXOPath(
        msg.addressNList,
        msg.coin,
        msg.scriptType
      );

      if (!description.isKnown) {
        return undefined;
      }

      let addressNList = msg.addressNList;

      if (
        addressNList[0] === 0x80000000 + 44 ||
        addressNList[0] === 0x80000000 + 49 ||
        addressNList[0] === 0x80000000 + 84
      ) {
        addressNList[2] += 1;
        return {
          ...msg,
          addressNList,
        };
      }

      return undefined;
    }
  };
}

export class NativeBTCWalletInfo extends MixinNativeBTCWalletInfo(
  class Base {}
) {}

export class NativeBTCWallet extends NativeBTCWalletInfo
  implements core.BTCWallet {
  _supportsBTC = true;

  btcGetAddress(msg: core.BTCGetAddress): Promise<string> {
    // TODO: implement
    return Promise.resolve(null);
  }
  btcSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx> {
    // TODO: implement
    return Promise.resolve(null);
  }
  btcSignMessage(msg: core.BTCSignMessage): Promise<core.BTCSignedMessage> {
    return Promise.resolve(null);
  }
  btcVerifyMessage(msg: core.BTCVerifyMessage): Promise<boolean> {
    return Promise.resolve(null);
  }
}
