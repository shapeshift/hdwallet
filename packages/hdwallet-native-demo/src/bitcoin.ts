import * as core from "@shapeshiftoss/hdwallet-core";
import * as bitcoin from "@shapeshiftoss/bitcoinjs-lib";
import { NativeHDWalletBase } from "./demo";


const supportedCoins = ["bitcoin", "dash", "digibyte", "dogecoin", "litecoin", "bitcoincash", "testnet"];

const segwit = ["p2wpkh", "p2sh-p2wpkh", "bech32"];

export type BTCScriptType = core.BTCInputScriptType | core.BTCOutputScriptType;

type NonWitnessUtxo = Buffer;

type WitnessUtxo = {
  script: Buffer;
  amount: Number;
};

type UtxoData = NonWitnessUtxo | WitnessUtxo;

type ScriptData = {
  redeemScript?: Buffer;
  witnessScript?: Buffer;
};

type BchInputData = {
  sighashType?: number
}

type InputData = UtxoData | ScriptData | BchInputData;

export function MixinNativeBTCWalletInfo<TBase extends core.Constructor<core.HDWalletInfo>>(Base: TBase) {
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

    btcIsSameAccount(msg: Array<core.BTCAccountPath>): boolean {
      // TODO: support at some point
      return false;
    }

    btcNextAccountPath(msg: core.BTCAccountPath): core.BTCAccountPath | undefined {
      const description = core.describeUTXOPath(msg.addressNList, msg.coin, msg.scriptType);

      if (!description.isKnown) {
        return undefined;
      }

      let addressNList = msg.addressNList;

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
  return class MixinNativeBTCWallet extends Base {
    readonly _supportsBTC = true;

    #masterKey: any | undefined;

    async btcInitializeWallet(masterKey: any): Promise<void> {
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

    validateVoutOrdering(msg: core.BTCSignTxNative, tx: bitcoin.Transaction): boolean {
      return true;
    }

    async btcGetAddress(msg: core.BTCGetAddress): Promise<string | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        return "1EC9SktW9Y4kS4iW48idshNg9eNeBdY5Xi"
      });
    }

    async btcSignTx(msg: core.BTCSignTxNative): Promise<core.BTCSignedTx | null> {
      return this.needsMnemonic(!!this.#masterKey, async () => {
        return {
          serializedTx:
              "010000000182488650ef25a58fef6788bd71b8212038d7f2bbe4750bc7bcb44701e85ef6d5000000006b4830450221009a0b7be0d4ed3146ee262b42202841834698bb3ee39c24e7437df208b8b7077102202b79ab1e7736219387dffe8d615bbdba87e11477104b867ef47afed1a5ede7810121023230848585885f63803a0a8aecdd6538792d5c539215c91698e315bf0253b43dffffffff0160cc0500000000001976a914de9b2a8da088824e8fe51debea566617d851537888ac00000000",
          signatures: [
            "30450221009a0b7be0d4ed3146ee262b42202841834698bb3ee39c24e7437df208b8b7077102202b79ab1e7736219387dffe8d615bbdba87e11477104b867ef47afed1a5ede781",
          ],
        };
      });
    }

    async btcSignMessage(msg: core.BTCSignMessage): Promise<core.BTCSignedMessage> {
      throw new Error("function not implemented");
    }

    async btcVerifyMessage(msg: core.BTCVerifyMessage): Promise<boolean> {
      throw new Error("function not implemented");
    }
  };
}
