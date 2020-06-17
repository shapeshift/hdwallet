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
      // Only support one account for now (like portis).
      // the ethers library supports paths so it shouldnt be too hard if we decide multiple accounts are needed
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
      return {
        v: decoded.v,
        r: decoded.r,
        s: decoded.s,
        serialized: result
      }
    }
    async ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage> {
      const result = await this.wallet.signMessage(msg.message)
      return {
        address: await this.wallet.getAddress(),
        signature: result
      }
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
