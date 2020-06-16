import * as bitcoin from "bitcoinjs-lib";
import { mnemonicToSeed } from "bip39";
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

type UndScriptyTypes = "p2pkh" | "p2sh-p2wpkh";

type ScriptType = {
  node: bitcoin.BIP32Interface;
  path: string;
};

type Wallet = {
  network: bitcoin.Network;
  rootNode: bitcoin.BIP32Interface;
  scripts: {
    [k in UndScriptyTypes]: ScriptType;
  };
};

export function MixinNativeBTCWallet<TBase extends core.Constructor>(
  Base: TBase
) {
  return class MixinNativeBTCWallet extends Base {
    wallet: Wallet;

    public async btcInitializeWallet(mnemonic: string): Promise<void> {
      const seed = Buffer.from(await mnemonicToSeed(mnemonic));
      const rootNode = bitcoin.bip32.fromSeed(seed, bitcoin.networks.bitcoin);

      this.wallet = {
        network: bitcoin.networks.bitcoin,
        rootNode,
        scripts: {
          p2pkh: {
            node: rootNode.derivePath("m/44'/0'/0'"),
            path: "m/44'/0'/0'",
          },
          "p2sh-p2wpkh": {
            node: rootNode.derivePath("m/49'/0'/0'"),
            path: "m/49'/0'/0'",
          },
        },
      };
    }

    btcGetAddress(msg: core.BTCGetAddress): Promise<string> {
      const keyPair = bitcoin.ECPair.fromWIF(
        this.wallet.rootNode.derivePath("m/49'/0'/0'/0/0").toWIF()
      );

      return Promise.resolve(
        bitcoin.payments.p2sh({
          redeem: bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey }),
        }).address
      );
    }

    async btcSignTx(msg: core.BTCSignTx): Promise<core.BTCSignedTx> {
      const network = this.wallet.network;
      const txBuilder = new bitcoin.TransactionBuilder(network);

      msg.inputs.forEach((input) =>
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

      await Promise.all(
        msg.outputs.map(async (output) => {
          if (output.addressNList) {
            const path = core.addressNListToBIP32(output.addressNList);
            const privateKey = this.wallet.rootNode.derivePath(path).toWIF();
            const keyPair = bitcoin.ECPair.fromWIF(privateKey, network);
            const pubkey = keyPair.publicKey;

            let address: string;
            switch (output.scriptType) {
              case "p2wpkh":
                address = bitcoin.payments.p2wpkh({ pubkey, network }).address;
                break;
              case "p2sh-p2wpkh":
                address = bitcoin.payments.p2sh({
                  redeem: bitcoin.payments.p2wpkh({ pubkey, network }),
                }).address;
                break;
              default:
                address = bitcoin.payments.p2pkh({ pubkey, network }).address;
            }

            txBuilder.addOutput(address, Number(output.amount));
          } else if (output.address) {
            txBuilder.addOutput(output.address, Number(output.amount));
          }
        })
      );

      await Promise.all(
        msg.inputs.map(async (input, idx) => {
          const path = core.addressNListToBIP32(input.addressNList);
          const privateKey = this.wallet.rootNode.derivePath(path).toWIF();
          const keyPair = bitcoin.ECPair.fromWIF(privateKey, network);
          const pubkey = keyPair.publicKey;

          switch (input.scriptType) {
            case "p2wpkh":
              txBuilder.sign(
                idx,
                keyPair,
                undefined,
                undefined,
                Number(input.amount)
              );
              break;
            case "p2sh-p2wpkh": {
              const output = bitcoin.payments.p2sh({
                redeem: bitcoin.payments.p2wpkh({ pubkey, network }),
              }).redeem.output;

              txBuilder.sign(
                idx,
                keyPair,
                output,
                undefined,
                Number(input.amount)
              );
              break;
            }
            case "p2sh":
            default:
              txBuilder.sign(idx, keyPair);
              break;
          }
        })
      );

      return {
        signatures: [],
        serializedTx: txBuilder.build().toHex(),
      };
    }

    btcSignMessage(msg: core.BTCSignMessage): Promise<core.BTCSignedMessage> {
      throw Error("function not implemented");
    }

    btcVerifyMessage(msg: core.BTCVerifyMessage): Promise<boolean> {
      throw Error("function not implemented");
    }
  };
}
