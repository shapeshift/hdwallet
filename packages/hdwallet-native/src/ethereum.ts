import * as core from "@shapeshiftoss/hdwallet-core";
import { Wallet, utils } from 'ethers'
import { ETHGetAddress } from "@shapeshiftoss/hdwallet-core";

export function MixinNativeETHWalletInfo<TBase extends core.Constructor>(
  Base: TBase
) {
  return class MixinNativeETHWalletInfo extends Base
    implements core.ETHWalletInfo {
    _supportsETHInfo = true;

    async ethSupportsNetwork(): Promise<boolean> {
      return true;
    }

    async ethSupportsSecureTransfer(): Promise<boolean> {
      return false;
    }

    ethSupportsNativeShapeShift(): boolean {
      return false;
    }

    ethGetAccountPaths(
      msg: core.ETHGetAccountPath
    ): Array<core.ETHAccountPath> {
      return [
        {
          addressNList: [
            0x80000000 + 44,
            0x80000000 + core.slip44ByCoin(msg.coin),
            0x80000000 + msg.accountIdx,
            0,
            0,
          ],
          hardenedPath: [
            0x80000000 + 44,
            0x80000000 + core.slip44ByCoin(msg.coin),
            0x80000000 + msg.accountIdx,
          ],
          relPath: [0, 0],
          description: "Native",
        },
      ];
    }

    ethNextAccountPath(msg: core.ETHAccountPath): core.ETHAccountPath {
      let addressNList = msg.hardenedPath.concat(msg.relPath);
      const description = core.describeETHPath(addressNList);

      if (!description.isKnown) {
        return undefined;
      }

      if (addressNList[0] === 0x80000000 + 44) {
        addressNList[2] += 1;
        return {
          ...msg,
          addressNList,
          hardenedPath: core.hardenedPath(addressNList),
          relPath: core.relativePath(addressNList),
        };
      }

      return undefined;
    }
  };
}

export class NativeETHWalletInfo extends MixinNativeETHWalletInfo(
  class Base {}
) {}

export function MixinNativeETHWallet<TBase extends core.Constructor>(
  Base: TBase
) {
  return class MixinNativeETHWallet extends Base {
    _supportsETH = true;

    ethWallet: Wallet;

    ethInitializeWallet(mnemonic: string): void {
      this.ethWallet = Wallet.fromMnemonic(mnemonic);
    }

    async ethGetAddress(msg: core.ETHGetAddress): Promise<string> {
      return this.ethWallet.getAddress();
    }
    ethSignTx(msg: core.ETHSignTx): Promise<core.ETHSignedTx> {
      console.log('ethSignTx')
      return Promise.resolve(null);
    }
    ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage> {
      console.log('ethSignMessage')
      return Promise.resolve(null);
    }

    async ethVerifyMessage(msg: core.ETHVerifyMessage): Promise<boolean> {
      const signingAddress = utils.verifyMessage(
        msg.message,
        "0x" + msg.signature
      );

      return signingAddress === msg.address;
    }
  }
}
