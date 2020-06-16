import * as core from "@shapeshiftoss/hdwallet-core";
import { Wallet, utils } from 'ethers'
import { ETHGetAddress } from "@shapeshiftoss/hdwallet-core";
import txDecoder from 'ethereum-tx-decoder'

export function MixinNativeETHWalletInfo<TBase extends core.Constructor>(
  Base: TBase
) {
  return class MixinNativeETHWalletInfo extends Base
    implements core.ETHWalletInfo {
    _supportsETHInfo = true;

    ethSupportsNetwork(): Promise<boolean> {
      return Promise.resolve(true);
    }

    ethSupportsSecureTransfer(): Promise<boolean> {
      return Promise.resolve(false);
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
    wallet: Wallet
    ethInitializeWallet(mnemonic: string): void {
      this.wallet = Wallet.fromMnemonic(mnemonic)
    }
    async ethGetAddress(msg: core.ETHGetAddress): Promise<string> {
      return this.wallet.getAddress()
    }
    async ethSignTx(msg: core.ETHSignTx): Promise<core.ETHSignedTx> {
      const transactionRequest = {
        to: msg.to,
        from: await this.wallet.getAddress(),
        nonce: msg.nonce,
        gasLimit: msg.gasLimit,
        gasPrice: msg.gasPrice,
        data: msg.data,
        value: msg.value,
        chainId: msg.chainId
      }
      const result = await this.wallet.signTransaction(transactionRequest)
      const decoded = txDecoder.decodeTx(result)
      const ethSignedTx = {
        v: decoded.v,
        r: decoded.r,
        s: decoded.s,
        serialized: result
      }
      return ethSignedTx
    }
    ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage> {
      console.log('ethSignMessage')
      return Promise.resolve(null);
    }
    async ethVerifyMessage(msg: core.ETHVerifyMessage): Promise<boolean> {
      const signingAddress = await utils.verifyMessage(
        msg.message,
        "0x" + msg.signature
      );
      return signingAddress === msg.address
    }
  }
}
