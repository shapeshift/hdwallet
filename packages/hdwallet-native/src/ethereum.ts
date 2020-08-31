import * as core from "@bithighlander/hdwallet-core";
import { Wallet, utils } from "ethers";
import { mnemonicToSeed } from "bip39";
import { getNetwork } from "./networks";
import * as bitcoin from "bitcoinjs-lib";
const txBuilder = require("ethereumjs-tx").Transaction;
const ethUtils = require("ethereumjs-util");

export function MixinNativeETHWalletInfo<TBase extends core.Constructor>(Base: TBase) {
  return class MixinNativeETHWalletInfo extends Base implements core.ETHWalletInfo {
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

    ethGetAccountPaths(msg: core.ETHGetAccountPath): Array<core.ETHAccountPath> {
      return [
        {
          addressNList: [0x80000000 + 44, 0x80000000 + core.slip44ByCoin(msg.coin), 0x80000000 + msg.accountIdx, 0, 0],
          hardenedPath: [0x80000000 + 44, 0x80000000 + core.slip44ByCoin(msg.coin), 0x80000000 + msg.accountIdx],
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

export function MixinNativeETHWallet<TBase extends core.Constructor>(Base: TBase) {
  return class MixinNativeETHWallet extends Base {
    _supportsETH = true;
    #seed = "";
    #ethWallet: Wallet;

    ethInitializeWallet(seed: string): void {
      this.#seed = seed;
    }

    async ethGetAddress(msg: core.ETHGetAddress): Promise<string> {
      const seed = await mnemonicToSeed(this.#seed);

      const network = getNetwork("ethereum");
      const wallet = bitcoin.bip32.fromSeed(seed, network);
      const path = core.addressNListToBIP32(msg.addressNList);
      const keypair = await bitcoin.ECPair.fromWIF(wallet.derivePath(path).toWIF(), network);
      let publicKey = keypair.publicKey;
      let address = ethUtils.bufferToHex(ethUtils.pubToAddress(publicKey, true));
      return address;
    }

    async ethSignTx(msg: core.ETHSignTx): Promise<core.ETHSignedTx> {
      const seed = await mnemonicToSeed(this.#seed);

      const network = getNetwork("ethereum");
      const mkey = bitcoin.bip32.fromSeed(seed, network);
      const path = core.addressNListToBIP32(msg.addressNList);

      let keypair = await bitcoin.ECPair.fromWIF(mkey.derivePath(path).toWIF(), network);
      let privateKey = keypair.privateKey;

      let txTemplate = {
        nonce: msg.nonce,
        to: msg.to,
        gasPrice: msg.gasPrice,
        gasLimit: msg.gasLimit,
        value: msg.value,
        data: msg.data,
      };

      let transaction = new txBuilder(txTemplate);
      transaction.sign(privateKey);

      const txid = "0x" + transaction.hash().toString("hex");
      let serialized = transaction.serialize();
      serialized = "0x" + serialized.toString("hex");

      return {
        v: transaction.v.toString("hex"),
        r: transaction.r.toString("hex"),
        s: transaction.s.toString("hex"),
        txid,
        serialized: serialized,
      };
    }

    async ethSignMessage(msg: core.ETHSignMessage): Promise<core.ETHSignedMessage> {
      const result = await this.#ethWallet.signMessage(msg.message);
      return {
        address: await this.#ethWallet.getAddress(),
        signature: result,
      };
    }

    async ethVerifyMessage(msg: core.ETHVerifyMessage): Promise<boolean> {
      if (!msg.signature.startsWith("0x")) msg.signature = `0x${msg.signature}`;
      const signingAddress = utils.verifyMessage(msg.message, msg.signature);
      return signingAddress === msg.address;
    }
  };
}
