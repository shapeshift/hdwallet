import * as core from "@shapeshiftoss/hdwallet-core";
import * as bitcoin from "bitcoinjs-lib";
import { NativeHDWallet } from './native'

const supportedCoins = ["Bitcoin"];

export class NativeBTCWalletInfo implements core.BTCWalletInfo {
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

  btcGetAccountPaths(msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
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
}

export async function btcGetAddress(wallet: NativeHDWallet, msg: core.BTCGetAddress): Promise<string> {
  const keyPair = bitcoin.ECPair.fromWIF(wallet.btcWallet.rootNode.derivePath("m/49'/0'/0'/0/0").toWIF())

  return Promise.resolve(bitcoin.payments.p2sh({
    redeem: bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey })
  }).address)
}

export async function btcSignTx(wallet: NativeHDWallet, msg: core.BTCSignTx): Promise<core.BTCSignedTx> {
  const txBuilder = new bitcoin.TransactionBuilder(wallet.btcWallet.network)

  function getSegWitAddress(pubkey: Buffer, network: bitcoin.networks.Network): string {
    return bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({ pubkey, network })
    }).address
  }
  
  function getNativeSegWitAddress(pubkey: Buffer, network: bitcoin.networks.Network): string {
    return bitcoin.payments.p2wpkh({ pubkey, network }).address
  }
  
  function getLegacyAddress(pubkey: Buffer, network: bitcoin.networks.Network): string {
    return bitcoin.payments.p2pkh({ pubkey, network }).address
  }

    msg.inputs.forEach(input =>
      txBuilder.addInput(
        input.txid,
        input.vout,
        null,
        input.scriptType === 'p2wpkh' && input.tx
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Buffer.from((msg as any).vout[input.vout].scriptPubKey.hex, 'hex')
          : undefined
      )
    )

    await Promise.all(
      msg.outputs.map(async output => {
        if (output.addressNList) {
          const path = core.addressNListToBIP32(output.addressNList)
          const privateKey = wallet.btcWallet.rootNode.derivePath(path).toWIF()
          const keyPair = bitcoin.ECPair.fromWIF(
            privateKey,
            wallet.btcWallet.network
          )

          let address: string
          if (output.scriptType === 'p2wpkh') {
            address = getNativeSegWitAddress(keyPair.publicKey, wallet.btcWallet.network)
          } else if (output.scriptType === 'p2sh-p2wpkh') {
            address = getSegWitAddress(keyPair.publicKey, wallet.btcWallet.network)
          } else {
            address = getLegacyAddress(keyPair.publicKey, wallet.btcWallet.network)
          }

          txBuilder.addOutput(address, Number(output.amount))
        } else if (output.address) {
          txBuilder.addOutput(output.address, Number(output.amount))
        }
      })
    )

    await Promise.all(
      msg.inputs.map(async (input, idx) => {
        const path = core.addressNListToBIP32(input.addressNList)
        const privateKey = wallet.btcWallet.rootNode.derivePath(path).toWIF()
        const keyPair = bitcoin.ECPair.fromWIF(privateKey, wallet.btcWallet.network)

        switch (input.scriptType) {
          case 'p2wpkh':
            txBuilder.sign(idx, keyPair, undefined, undefined, Number(input.amount))
            break
          case 'p2sh-p2wpkh': {
            const p2wpkh = bitcoin.payments.p2wpkh({
              pubkey: keyPair.publicKey,
              network: wallet.btcWallet.network
            })
            const p2sh = bitcoin.payments.p2sh({ redeem: p2wpkh, network: wallet.btcWallet.network })
            txBuilder.sign(idx, keyPair, p2sh.redeem.output, undefined, Number(input.amount))
            break
          }
          case 'p2sh':
          default:
            txBuilder.sign(idx, keyPair)
            break
        }
      })
    )

    return {
      signatures: [],
      serializedTx: txBuilder.build().toHex()
    }
}

export class NativeBTCWallet extends NativeBTCWalletInfo
  implements core.BTCWallet {
  _supportsBTC = true;


  btcGetAddress(msg: core.BTCGetAddress): Promise<string> {
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
