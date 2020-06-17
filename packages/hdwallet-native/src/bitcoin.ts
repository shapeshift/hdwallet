import * as core from "@shapeshiftoss/hdwallet-core";
import { getNetwork } from "./networks";

const supportedCoins = ["Bitcoin"];

export function MixinNativeBTCWalletInfo<TBase extends core.Constructor>(
  Base: TBase
) {
  return class MixinNativeBTCWalletInfo extends Base
    implements core.BTCWalletInfo {
    _supportsBTCInfo = true;

    async btcSupportsCoin(coin: core.Coin): Promise<boolean> {
      return supportedCoins.includes(coin);
    }

    async btcSupportsScriptType(
      coin: core.Coin,
      scriptType: core.BTCInputScriptType
    ): Promise<boolean> {
      if (!this.btcSupportsCoin(coin)) return false;

      switch (scriptType) {
        case core.BTCInputScriptType.SpendAddress:
        case core.BTCInputScriptType.SpendWitness:
        case core.BTCInputScriptType.SpendP2SHWitness:
          return true;
        default:
          return false;
      }
    }

    async btcSupportsSecureTransfer(): Promise<boolean> {
      return false;
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

export function MixinNativeBTCWallet<TBase extends core.Constructor>(
  Base: TBase
) {
  return class MixinNativeBTCWallet extends Base {
    btcWallet: bitcoin.BIP32Interface;

    createPayment(
      pubkey: Buffer,
      scriptType: core.BTCInputScriptType | core.BTCOutputScriptType,
      network?: bitcoin.Network
    ): bitcoin.Payment {
      switch (scriptType) {
        case "p2sh":
          return bitcoin.payments.p2sh({ pubkey, network });
        case "p2pkh":
          return bitcoin.payments.p2pkh({ pubkey, network });
        case "p2wpkh":
          return bitcoin.payments.p2wpkh({ pubkey, network });
        case "p2sh-p2wpkh":
          return bitcoin.payments.p2sh({
            redeem: bitcoin.payments.p2wpkh({ pubkey, network }),
          });
        default:
          throw new Error(`no implementation for script type: ${scriptType}`);
      }
    }

    async btcInitializeWallet(mnemonic: string): Promise<void> {
      const seed = Buffer.from(await mnemonicToSeed(mnemonic));
      this.btcWallet = bitcoin.bip32.fromSeed(seed);
    }

    async btcGetAddress(msg: core.BTCGetAddress): Promise<string> {
      const { addressNList, coin, scriptType } = msg;
      const network = getNetwork(coin, scriptType);
      const path = core.addressNListToBIP32(addressNList);
      const keyPair = bitcoin.ECPair.fromWIF(
        this.btcWallet.derivePath(path).toWIF(),
        network
      );
      return this.createPayment(keyPair.publicKey, scriptType, network).address;
    }

    async btcSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx> {
      const { coin, inputs, outputs } = msg;
      const network = getNetwork(coin, inputs[0].scriptType);
      const txBuilder = new bitcoin.TransactionBuilder(network);

      inputs.forEach((input) =>
        txBuilder.addInput(
          input.txid,
          input.vout,
          null,
          input.scriptType === "p2wpkh" && input.tx
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              Buffer.from((msg as any).vout[input.vout].scriptPubKey.hex, "hex")
            : undefined
        )
      );

      Promise.all(
        outputs.map(async (output) => {
          if (output.addressNList) {
            const path = core.addressNListToBIP32(output.addressNList);
            const privateKey = this.btcWallet.derivePath(path).toWIF();
            const keyPair = bitcoin.ECPair.fromWIF(privateKey, network);
            const { address } = this.createPayment(
              keyPair.publicKey,
              output.scriptType
            );
            txBuilder.addOutput(address, Number(output.amount));
          } else if (output.address) {
            txBuilder.addOutput(output.address, Number(output.amount));
          }

      Promise.all(
        inputs.map(async (input, vin) => {
          const path = core.addressNListToBIP32(input.addressNList);
          const privateKey = this.btcWallet.derivePath(path).toWIF();
          const keyPair = bitcoin.ECPair.fromWIF(privateKey, network);

          let redeemScript: Buffer;
          let hashType: number;
          let witnessValue: number;
          let witnessScript: Buffer;
          switch (input.scriptType) {
            case "p2wpkh":
              witnessValue = Number(input.amount);
              break;
            case "p2sh-p2wpkh": {
              const payment = this.createPayment(
                keyPair.publicKey,
                input.scriptType,
                network
              );
              witnessValue = Number(input.amount);
              witnessScript = payment.redeem.output;
              break;
            }
          }

          txBuilder.sign(
            vin,
            keyPair,
            redeemScript,
            hashType,
            witnessValue,
            witnessScript
          );
        })
      );

      return {
        signatures: [],
        serializedTx: txBuilder.build().toHex(),
      };
    }

    async btcSignMessage(
      msg: core.BTCSignMessage
    ): Promise<core.BTCSignedMessage> {
      throw new Error("function not implemented");
    }
}

    async btcVerifyMessage(msg: core.BTCVerifyMessage): Promise<boolean> {
      throw new Error("function not implemented");
    }
  };
}
