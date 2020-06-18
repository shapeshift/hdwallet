import * as core from "@shapeshiftoss/hdwallet-core";
import { getNetwork } from "./networks";

const supportedCoins = [
  "bitcoin",
  "dash",
  "digibyte",
  "dogecoin",
  "litecoin",
  "testnet",
];

export function MixinNativeBTCWalletInfo<TBase extends core.Constructor>(
  Base: TBase
) {
  return class MixinNativeBTCWalletInfo extends Base
    implements core.BTCWalletInfo {
    _supportsBTCInfo = true;

    async btcSupportsCoin(coin: core.Coin): Promise<boolean> {
      return supportedCoins.includes(coin.toLowerCase());
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
        bitcoin: [bip44, bip49, bip84],
        dash: [bip44],
        digibyte: [bip44, bip49, bip84],
        dogecoin: [bip44],
        litecoin: [bip44, bip49, bip84],
        testnet: [bip44, bip49, bip84],
      };

      let paths: Array<core.BTCAccountPath> =
        coinPaths[msg.coin.toLowerCase()] || [];

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
    seed: Buffer;

    createPayment(
      pubkey: Buffer,
      scriptType: core.BTCScriptType,
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

    getKeyPair(
      coin: string,
      addressNList: core.BIP32Path,
      scriptType?: core.BTCScriptType
    ): bitcoin.ECPairInterface {
      const network = getNetwork(coin, scriptType);
      const wallet = bitcoin.bip32.fromSeed(this.seed, network);
      const path = core.addressNListToBIP32(addressNList);
      return bitcoin.ECPair.fromWIF(wallet.derivePath(path).toWIF(), network);
    }

    async btcInitializeWallet(mnemonic: string): Promise<void> {
      this.seed = Buffer.from(await mnemonicToSeed(mnemonic));
    }

    async btcGetAddress(msg: core.BTCGetAddress): Promise<string> {
      const { addressNList, coin, scriptType } = msg;
      const keyPair = this.getKeyPair(coin, addressNList, scriptType);
      return this.createPayment(keyPair.publicKey, scriptType, keyPair.network)
        .address;
    }

    async btcSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx> {
      const { coin, inputs, outputs, version, locktime } = msg;

      const psbt = new bitcoin.Psbt({ network: getNetwork(coin) });

      psbt.setVersion(version);
      psbt.setLocktime(locktime);

      inputs.forEach((input) => {
        try {
          const { addressNList, scriptType } = input;
          const keyPair = this.getKeyPair(coin, addressNList, scriptType);

          const isWitness = ["p2wpkh"].includes(input.scriptType);
          const nonWitnessUtxo = Buffer.from(input.hex, "hex");
          const witnessUtxo = input.tx
            ? {
                script: Buffer.from(
                  input.tx.vout[input.vout].scriptPubKey.hex,
                  "hex"
                ),
                value: Number(input.amount),
              }
            : undefined;

          const payment = this.createPayment(
            keyPair.publicKey,
            input.scriptType,
            keyPair.network
          );

          const utxoData =
            isWitness && witnessUtxo ? { witnessUtxo } : { nonWitnessUtxo };

          psbt.addInput({
            hash: input.txid,
            index: input.vout,
            ...utxoData,
            redeemScript: payment.redeem.output,
          });
        } catch (e) {
          console.log("failed to add input", e);
        }
      });

      outputs.map((output) => {
        try {
          const { address: addr, amount, addressNList, scriptType } = output;
          let address = addr;

          if (!address) {
            const keyPair = this.getKeyPair(coin, addressNList, scriptType);
            address = this.createPayment(
              keyPair.publicKey,
              scriptType,
              keyPair.network
            ).address;
          }

          psbt.addOutput({ address, value: Number(amount) });
        } catch (e) {
          console.log("failed to add output", e);
        }
      });

      inputs.forEach((input, idx) => {
        try {
          const { addressNList, scriptType } = input;
          const keyPair = this.getKeyPair(coin, addressNList, scriptType);
          psbt.signInput(idx, keyPair);
        } catch (e) {
          console.log("failed to sign input", e);
        }
      });

      psbt.finalizeAllInputs();

      const signatures = psbt.extractTransaction().ins.map((input) => {
        const sigLen = input.script[0];
        return input.script.slice(1, sigLen).toString("hex");
      });

      return {
        signatures,
        serializedTx: psbt.extractTransaction().toHex(),
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
