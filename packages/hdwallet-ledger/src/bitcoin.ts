import Base64 from 'base64-js'
import { verify } from 'bitcoinjs-message'
import {
  addressNListToBIP32,
  BTCAccountPath,
  BTCGetAccountPaths,
  BTCGetAddress,
  BTCInputScriptType,
  BTCSignedMessage,
  BTCSignedTx,
  BTCSignMessage,
  BTCSignTx,
  BTCVerifyMessage,
  BTCWallet,
  BTCOutputAddressType,
  Coin,
  Constructor,
  fromHexString,
  slip44ByCoin,
} from '@shapeshiftoss/hdwallet-core'
import { LedgerTransport } from './transport'
import {
  translateScriptType,
  networksUtil
} from './utils'
import {
  TransactionBuilder,
  networks
} from 'bitcoinjs-lib'
import { zip } from "lodash";

const supportedCoins = [
  'Testnet',
  'Bitcoin',
  'BitcoinCash',
  'Litecoin',
  'Dash',
  'DigiByte',
  'Dogecoin'
]

const segwitCoins = [
  'Bitcoin',
  'Litecoin',
  'BitcoinGold',
  'Testnet'
]

export class LedgerBTCWallet {
  _supportsBTC: boolean
  transport: LedgerTransport

  protected handleError: (response: any, message: string) => void

  public async btcSupportsCoin (coin: Coin): Promise<boolean> {
    return supportedCoins.includes(coin)
  }

  public async btcSupportsScriptType (coin: Coin, scriptType: BTCInputScriptType): Promise<boolean> {
    const supported = {
      Bitcoin: [
        BTCInputScriptType.SpendAddress,
        BTCInputScriptType.SpendWitness,
        BTCInputScriptType.SpendP2SHWitness
      ],
      BitcoinCash: [
        BTCInputScriptType.SpendAddress
      ]
    }

    return !!supported[coin] && supported[coin].includes(scriptType)
  }

  public async btcGetAddress (msg: BTCGetAddress): Promise<string> {
    const bip32path = addressNListToBIP32(msg.addressNList)
    const opts = {
      verify: !!msg.showDisplay,
      format: translateScriptType(msg.scriptType)
    }

    const res = await this.transport.call('Btc', 'getWalletPublicKey', bip32path, opts)
    this.handleError(res, 'Unable to obtain BTC address from device')

    return res.payload.bitcoinAddress
  }

  /*
    Sign Transaction UTXO's
        (Utilizing bitcoinjs-lib TxBuilder object)
                -Highlander

    Links: (ledger) https://www.npmjs.com/package/@ledgerhq/hw-app-btc#createpaymenttransactionnew
           (txBuilder) https://github.com/bitcoinjs/bitcoinjs-lib/issues/1011#issuecomment-368397505
    Inputs:
        See Type object --
    Outputs:
        See type object --

    Objects built internally:
      Output script
      raw Unsigned Tx

    createPaymentTransactionNew
     * inputs Array<[Transaction, number, string?, number?]> is an array of [ transaction, output_index, optional redeem script, optional sequence ]
     * where- transaction is the previously computed transaction object for this UTXO
          * output_index is the output in the transaction used as input for this UTXO (counting from 0)
          * redeem script is the optional redeem script to use when consuming a Segregated Witness input
          * sequence is the sequence number to use for this input (when using RBF), or non present
      * associatedKeysets Array<string> is an array of BIP 32 paths pointing to the path to the private key used for each UTXO
      * changePath string is an optional BIP 32 path pointing to the path to the public key used to compute the change address
      * outputScriptHex string is the hexadecimal serialized outputs of the transaction to sign
             ( lockTime number is the optional lockTime of the transaction to sign, or default (0)
      * sigHashType number is the hash type of the transaction to sign, or default (all)
      * segwit boolean (is an optional boolean indicating wether to use segwit or not)
      * initialTimestamp number is an optional timestamp of the function call to use for coins that necessitate timestamps only, (not the one that the tx will include)
      * additionals Array<string> list of additionnal options- "abc" for bch
          "gold" for btg
          "bipxxx" for using BIPxxx
          "sapling" to indicate a zec transaction is supporting sapling (to be set over block 419200)
      * expiryHeight Buffer is an optional Buffer for zec overwinter / sapling Txs

   */
  public async btcSignTx (msg: BTCSignTx): Promise<BTCSignedTx> {
    let supportsShapeShift = await this.btcSupportsNativeShapeShift()
    let supportsSecureTransfer = await this.btcSupportsSecureTransfer()
    let slip44 = slip44ByCoin(msg.coin)
    let txBuilder = new TransactionBuilder(networksUtil[slip44].bitcoinjs)
    let indexes = [];
    let txs = [];
    let paths = []
    let segwit = false

    //bitcoinjs-lib
    msg.outputs.map(output => {
      if (output.exchangeType && !supportsShapeShift)
        throw new Error("Ledger does not support Native ShapeShift")

      if (output.addressNList) {
        if (output.addressType === BTCOutputAddressType.Transfer && !supportsSecureTransfer)
          throw new Error("Ledger does not support SecureTransfer")
      }
      txBuilder.addOutput(output.address, output.amount)
    })

    let unsignedHex = txBuilder.buildIncomplete().toHex()
    let splitTx = await this.transport.call('Btc', 'splitTransaction', unsignedHex)
    let outputScriptHex = await this.transport.call('Btc', 'serializeTransactionOutputs', splitTx.payload)
    outputScriptHex = outputScriptHex.payload.toString("hex")

    for(let i = 0; i < msg.inputs.length; i++){
      if(msg.inputs[i].scriptType === BTCInputScriptType.SpendWitness || msg.inputs[i].scriptType === BTCInputScriptType.SpendP2SHWitness) segwit = true
      let path = addressNListToBIP32(msg.inputs[i].addressNList)
      let vout = msg.inputs[i].vout

      let tx = await this.transport.call('Btc', 'splitTransaction', msg.inputs[i].hex,
        networksUtil[slip44].isSegwitSupported,
        networksUtil[slip44].areTransactionTimestamped)

      indexes.push(vout)
      txs.push(tx.payload)
      paths.push(path)
    }
    const inputs = zip(txs, indexes);

    //sign createPaymentTransaction
    let signedTx = await this.transport.call('Btc', 'createPaymentTransactionNew', inputs, paths, undefined, outputScriptHex, null, networksUtil[slip44].sigHash, segwit)

    return {serializedTx:signedTx.payload,signatures:[]}
  }

  public async btcSupportsSecureTransfer (): Promise<boolean> {
    return false
  }

  public async btcSupportsNativeShapeShift (): Promise<boolean> {
    return false
  }

  public async btcSignMessage (msg: BTCSignMessage): Promise<BTCSignedMessage> {
    const bip32path = addressNListToBIP32(msg.addressNList)

    const res = await this.transport.call('Btc', 'signMessageNew', bip32path, Buffer.from(msg.message).toString("hex"))
    this.handleError(res, 'Could not sign message with device')
    const v = res.payload['v'] + 27 + 4

    const signature = Buffer.from(v.toString(16) + res.payload['r'] + res.payload['s'], 'hex').toString('hex')

    const getAddressParams = {
      addressNList: msg.addressNList,
      coin: msg.coin,
      showDisplay: false,
      scriptType: msg.scriptType
    }
    const address = await this.btcGetAddress(getAddressParams)

    return {
      address,
      signature
    }
  }

  public async btcVerifyMessage (msg: BTCVerifyMessage): Promise<boolean> {
    const signature = Base64.fromByteArray(fromHexString(msg.signature))
    return verify(msg.message, msg.address, signature)
  }

  public btcGetAccountPaths (msg: BTCGetAccountPaths): Array<BTCAccountPath> {
    const slip44 = slip44ByCoin(msg.coin)
    const bip49 = {
      scriptType: BTCInputScriptType.SpendP2SHWitness,
      addressNList: [0x80000000 + 49, 0x80000000 + slip44, 0x80000000 + msg.accountIdx]
    }
    const bip44 = {
      scriptType: BTCInputScriptType.SpendAddress,
      addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx]
    }
    const bip84 = {
      scriptType: BTCInputScriptType.SpendWitness,
      addressNList: [0x80000000 + 84, 0x80000000 + slip44, 0x80000000 + msg.accountIdx]
    }

    let paths: Array<BTCAccountPath>

    if (segwitCoins.includes(msg.coin))
      paths = [ bip49, bip44, bip84 ]
    else
      paths = [ bip44 ]

    if (msg.scriptType !== undefined)
      paths = paths.filter(path => { return path.scriptType === msg.scriptType })

    return paths
  }

  public btcIsSameAccount (msg: Array<BTCAccountPath>): boolean {
    return true
  }
}
