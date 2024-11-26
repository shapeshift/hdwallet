import * as bitcoin from "@shapeshiftoss/bitcoinjs-lib";
import * as core from "@shapeshiftoss/hdwallet-core";
import { fromHexString } from "@shapeshiftoss/hdwallet-core";
import * as bchAddr from "bchaddrjs";

import * as Isolation from "./crypto/isolation";
import { NativeHDWalletBase } from "./native";
import { getNetwork } from "./networks";
import * as util from "./util";

const supportedCoins = ["bitcoin", "dash", "digibyte", "dogecoin", "litecoin", "bitcoincash", "testnet"];

const segwit = ["p2wpkh", "p2sh-p2wpkh", "bech32"];

export type BTCScriptType = core.BTCInputScriptType | core.BTCOutputScriptType;

type NonWitnessUtxo = Buffer;

type WitnessUtxo = {
  script: Buffer;
  amount: number;
};

type UtxoData = NonWitnessUtxo | WitnessUtxo;

type ScriptData = {
  redeemScript?: Buffer;
  witnessScript?: Buffer;
};

type InputData = UtxoData | ScriptData;

export function MixinNativeBTCWalletInfo<TBase extends core.Constructor<core.HDWalletInfo>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeBTCWalletInfo extends Base implements core.BTCWalletInfo {
    readonly _supportsBTCInfo = true;

    btcSupportsCoinSync(coin: core.Coin): boolean {
      return supportedCoins.includes(String(coin).toLowerCase());
    }

    async btcSupportsCoin(coin: core.Coin): Promise<boolean> {
      return this.btcSupportsCoinSync(coin);
    }

    btcSupportsScriptTypeSync(coin: core.Coin, scriptType?: core.BTCInputScriptType): boolean {
      if (!this.btcSupportsCoinSync(coin)) return false;

      switch (scriptType) {
        case core.BTCInputScriptType.SpendMultisig:
        case core.BTCInputScriptType.SpendAddress:
        case core.BTCInputScriptType.SpendWitness:
        case core.BTCInputScriptType.Bech32:
        case core.BTCInputScriptType.SpendP2SHWitness:
          return true;
        default:
          return false;
      }
    }

    async btcSupportsScriptType(coin: core.Coin, scriptType: core.BTCInputScriptType): Promise<boolean> {
      return this.btcSupportsScriptTypeSync(coin, scriptType);
    }

    async btcSupportsSecureTransfer(): Promise<boolean> {
      return false;
    }

    btcSupportsNativeShapeShift(): boolean {
      return false;
    }

    btcGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
      const slip44 = core.slip44ByCoin(msg.coin);
      if (slip44 === undefined) return [];
      const bip44 = core.legacyAccount(msg.coin, slip44, msg.accountIdx);
      const bip49 = core.segwitAccount(msg.coin, slip44, msg.accountIdx);
      const bip84 = core.segwitNativeAccount(msg.coin, slip44, msg.accountIdx);

      const coinPaths = {
        bitcoin: [bip44, bip49, bip84],
        bitcoincash: [bip44, bip49, bip84],
        dash: [bip44],
        digibyte: [bip44, bip49, bip84],
        dogecoin: [bip44],
        litecoin: [bip44, bip49, bip84],
        testnet: [bip44, bip49, bip84],
      } as Partial<Record<string, Array<core.BTCAccountPath>>>;

      let paths: Array<core.BTCAccountPath> = coinPaths[msg.coin.toLowerCase()] || [];

      if (msg.scriptType !== undefined) {
        paths = paths.filter((path) => {
          return path.scriptType === msg.scriptType;
        });
      }

      return paths;
    }

    btcNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
      const description = core.describeUTXOPath(msg.addressNList, msg.coin, msg.scriptType);

      if (!description.isKnown) {
        return undefined;
      }

      const addressNList = msg.addressNList;

      if (
        (addressNList[0] === 0x80000000 + 44 && msg.scriptType == core.BTCInputScriptType.SpendAddress) ||
        (addressNList[0] === 0x80000000 + 49 && msg.scriptType == core.BTCInputScriptType.SpendP2SHWitness) ||
        (addressNList[0] === 0x80000000 + 84 && msg.scriptType == core.BTCInputScriptType.SpendWitness)
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

export function MixinNativeBTCWallet<TBase extends core.Constructor<NativeHDWalletBase>>(Base: TBase) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return class MixinNativeBTCWallet extends Base {
    readonly _supportsBTC = true;

    #masterKey: Isolation.Core.BIP32.Node | undefined;

    async btcInitializeWallet(masterKey: Isolation.Core.BIP32.Node): Promise<void> {
      this.#masterKey = masterKey;
    }

    btcWipe(): void {
      this.#masterKey = undefined;
    }

    createPayment(pubkey: Buffer, scriptType?: BTCScriptType, network?: bitcoin.Network): bitcoin.Payment {
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
            network,
          });
        case "bech32":
          return bitcoin.payments.p2wsh({
            redeem: bitcoin.payments.p2wsh({ pubkey, network }),
            network,
          });
        default:
          throw new Error(`no implementation for script type: ${scriptType}`);
      }
    }

    async buildInput(coin: core.Coin, input: core.BTCSignTxInputNative): Promise<InputData | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        const { addressNList, amount, hex, scriptType } = input;

        const keyPair = await util.getKeyPair(this.#masterKey!, addressNList, coin, scriptType);

        const isSegwit = !!scriptType && segwit.includes(scriptType);
        const nonWitnessUtxo = hex && Buffer.from(hex, "hex");
        const witnessUtxo = input.tx &&
          amount && {
            script: fromHexString(input.tx.vout[input.vout].scriptPubKey.hex),
            value: BigInt(amount),
          };
        const utxoData = isSegwit && witnessUtxo ? { witnessUtxo } : { nonWitnessUtxo };

        if (!(utxoData.witnessUtxo || utxoData.nonWitnessUtxo)) {
          throw new Error(
            "failed to build input - must provide prev rawTx (segwit input can provide scriptPubKey hex and value instead)"
          );
        }

        const { publicKey, network } = keyPair;
        const payment = this.createPayment(publicKey, scriptType, network);

        const scriptData: ScriptData = {};
        switch (scriptType) {
          case "p2sh-p2wpkh":
          case "p2sh":
          case "bech32":
            scriptData.redeemScript = payment.redeem?.output ? Buffer.from(payment.redeem.output) : undefined;
            break;
        }

        return {
          ...utxoData,
          ...scriptData,
        };
      });
    }

    async btcGetAddress(msg: core.BTCGetAddress): Promise<string | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        const { addressNList, coin, scriptType } = msg;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const keyPair = await util.getKeyPair(this.#masterKey!, addressNList, coin, scriptType);
        const { address } = this.createPayment(keyPair.publicKey, scriptType, keyPair.network);
        if (!address) return null;
        return coin.toLowerCase() === "bitcoincash" ? bchAddr.toCashAddress(address) : address;
      });
    }

    async btcSignTx(msg: core.BTCSignTxNative): Promise<core.BTCSignedTx | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        const { coin, inputs, outputs, version, locktime } = msg;

        const psbt = new bitcoin.Psbt({
          network: getNetwork(coin),
          forkCoin: coin.toLowerCase() === "bitcoincash" ? "bch" : "none",
        });

        psbt.setVersion(version ?? 1);
        locktime && psbt.setLocktime(locktime);

        await Promise.all(
          inputs.map(async (input) => {
            try {
              const inputData = await this.buildInput(coin, input);

              psbt.addInput({
                hash: input.txid,
                index: input.vout,
                ...inputData,
              });
            } catch (e) {
              throw new Error(`failed to add input: ${e}`);
            }
          })
        );

        await Promise.all(
          outputs.map(async (output) => {
            if (!output.amount) throw new Error("missing amount for spend output");

            try {
              const { amount } = output;

              let address: string;
              if (output.address !== undefined) {
                address = output.address;
              } else if (output.addressNList !== undefined) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const keyPair = await util.getKeyPair(this.#masterKey!, output.addressNList, coin, output.scriptType);
                const { publicKey, network } = keyPair;
                const payment = this.createPayment(publicKey, output.scriptType, network);
                if (!payment.address) throw new Error("could not get payment address");
                address = payment.address;
              } else {
                throw new Error("unsupported output type");
              }

              if (coin.toLowerCase() === "bitcoincash") {
                address = bchAddr.toLegacyAddress(address);
              }

              psbt.addOutput({ address, value: BigInt(amount) });
            } catch (e) {
              throw new Error(`failed to add output: ${e}`);
            }
          })
        );

        if (msg.opReturnData) {
          const data = Buffer.from(msg.opReturnData, "utf-8");
          const embed = bitcoin.payments.embed({ data: [data] });
          const script = embed.output;
          if (!script) throw new Error("unable to build OP_RETURN script");
          // OP_RETURN_DATA outputs always have a value of 0
          psbt.addOutput({ script, value: BigInt(0) });
        }

        await Promise.all(
          inputs.map(async (input, idx) => {
            try {
              const { addressNList, scriptType } = input;
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              const keyPair = await util.getKeyPair(this.#masterKey!, addressNList, coin, scriptType);

              await psbt.signInputAsync(idx, keyPair);
            } catch (e) {
              throw new Error(`failed to sign input: ${e}`);
            }
          })
        );

        psbt.finalizeAllInputs();

        const tx = psbt.extractTransaction(true);

        // If this is a THORChain transaction, validate the vout ordering
        if (msg.vaultAddress && !core.validateVoutOrdering(msg, tx)) {
          throw new Error("Improper vout ordering for BTC Thorchain transaction");
        }

        const signatures = tx.ins.map((input) => {
          if (input.witness.length > 0) {
            return Buffer.from(input.witness[0]).toString("hex");
          } else {
            const sigLen = input.script[0];
            return Buffer.from(input.script.slice(1, sigLen)).toString("hex");
          }
        });

        return {
          signatures,
          serializedTx: tx.toHex(),
        };
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async btcSignMessage(_msg: core.BTCSignMessage): Promise<core.BTCSignedMessage> {
      throw new Error("function not implemented");
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async btcVerifyMessage(_msg: core.BTCVerifyMessage): Promise<boolean> {
      throw new Error("function not implemented");
    }
  };
}
