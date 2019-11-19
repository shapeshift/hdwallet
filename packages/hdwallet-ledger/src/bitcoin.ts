import { zip } from "lodash";
import Base64 from 'base64-js'
import { isCashAddress, toLegacyAddress} from 'bchaddrjs'
import { crypto, TransactionBuilder, networks } from 'bitcoinjs-lib'
import { verify } from 'bitcoinjs-message'
import * as core from '@shapeshiftoss/hdwallet-core'
import { LedgerTransport } from './transport'
import {
  createXpub,
  compressPublicKey,
  encodeBase58Check,
  translateScriptType,
  networksUtil,
  parseHexString,
  handleError
} from './utils'

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
  'DigiByte',
  'Litecoin',
  'BitcoinGold',
  'Testnet'
]

export async function btcSupportsCoin (coin: core.Coin): Promise<boolean> {
  return supportedCoins.includes(coin)
}

export async function btcSupportsScriptType (coin: core.Coin, scriptType: core.BTCInputScriptType): Promise<boolean> {
  const supported = {
    Bitcoin: [
      core.BTCInputScriptType.SpendAddress,
      core.BTCInputScriptType.SpendWitness,
      core.BTCInputScriptType.SpendP2SHWitness
    ],
    BitcoinCash: [
      core.BTCInputScriptType.SpendAddress
    ]
  }

  return !!supported[coin] && supported[coin].includes(scriptType)
}

export async function btcGetAddress (transport: LedgerTransport, msg: core.BTCGetAddress): Promise<string> {
  const bip32path = core.addressNListToBIP32(msg.addressNList)
  const opts = {
    verify: !!msg.showDisplay,
    format: translateScriptType(msg.scriptType)
  }

  const res = await transport.call('Btc', 'getWalletPublicKey', bip32path, opts)
  handleError(res, transport, 'Unable to obtain BTC address from device')

  return res.payload.bitcoinAddress
}

// Adapted from https://github.com/LedgerHQ/ledger-wallet-webtool
export async function btcGetPublicKeys (transport: LedgerTransport, msg: Array<core.GetPublicKey>): Promise<Array<core.PublicKey | null>> {
    const xpubs = []

    for (const getPublicKey of msg) {
      let { addressNList, coin, scriptType } = getPublicKey

      const parentBip32path: string = core.addressNListToBIP32(addressNList.slice(0, -1)).substring(2) // i.e. "44'/0'"
      const bip32path: string = core.addressNListToBIP32(addressNList).substring(2) // i.e 44'/0'/0'

      const opts = { verify: false }

      const res1 = await transport.call('Btc', 'getWalletPublicKey', parentBip32path, opts)
      handleError(res1, transport, 'Unable to obtain public key from device.')

      let { payload: { publicKey: parentPublicKey } } = res1
      parentPublicKey = parseHexString(compressPublicKey(parentPublicKey))

      let result = crypto.sha256(parentPublicKey)
      result = crypto.ripemd160(result)

      const fingerprint: number = ((result[0] << 24) | (result[1] << 16) | (result[2] << 8) | result[3]) >>> 0

      const res2 = await transport.call('Btc', 'getWalletPublicKey', bip32path, opts)
      handleError(res2, transport, 'Unable to obtain public key from device.')

      let { payload: { publicKey, chainCode } } = res2
      publicKey = compressPublicKey(publicKey)

      const coinDetails: any = networksUtil[core.slip44ByCoin(coin)]
      const childNum: number = addressNList[addressNList.length -1]

      scriptType = scriptType || core.BTCInputScriptType.SpendAddress
      const networkMagic = coinDetails.bitcoinjs.bip32.public[scriptType]

      const xpub = createXpub(
        addressNList.length,
        fingerprint,
        childNum,
        chainCode,
        publicKey,
        networkMagic
      )

      xpubs.push({ xpub: encodeBase58Check(xpub) })
    }

    return xpubs
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
    * segwit boolean (is an optional boolean indicating whether to use segwit or not)
    * initialTimestamp number is an optional timestamp of the function call to use for coins that necessitate timestamps only, (not the one that the tx will include)
    * additionals Array<string> list of additional options- "abc" for bch
        "gold" for btg
        "bipxxx" for using BIPxxx
        "sapling" to indicate a zec transaction is supporting sapling (to be set over block 419200)
    * expiryHeight Buffer is an optional Buffer for zec overwinter / sapling Txs

 */
export async function btcSignTx (wallet: core.BTCWallet, transport: LedgerTransport, msg: core.BTCSignTx): Promise<core.BTCSignedTx> {
  let supportsShapeShift = wallet.btcSupportsNativeShapeShift()
  let supportsSecureTransfer = await wallet.btcSupportsSecureTransfer()
  let slip44 = core.slip44ByCoin(msg.coin)
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
      if (output.addressType === core.BTCOutputAddressType.Transfer && !supportsSecureTransfer)
        throw new Error("Ledger does not support SecureTransfer")
    }
    if (msg.coin === 'BitcoinCash' && isCashAddress(output.address)) {
      output.address = toLegacyAddress(output.address)
    }
    txBuilder.addOutput(output.address, Number(output.amount))
  })

  let unsignedHex = txBuilder.buildIncomplete().toHex()
  let splitTx = await transport.call('Btc', 'splitTransaction', unsignedHex)
  let outputScriptHex = await transport.call('Btc', 'serializeTransactionOutputs', splitTx.payload)
  outputScriptHex = outputScriptHex.payload.toString('hex')

  for(let i = 0; i < msg.inputs.length; i++){
    if (
      msg.inputs[i].scriptType === core.BTCInputScriptType.SpendWitness ||
      msg.inputs[i].scriptType === core.BTCInputScriptType.SpendP2SHWitness
    ) segwit = true

    let path = core.addressNListToBIP32(msg.inputs[i].addressNList)
    let vout = msg.inputs[i].vout

    let tx = await transport.call(
      'Btc',
      'splitTransaction',
      msg.inputs[i].hex, networksUtil[slip44].isSegwitSupported, networksUtil[slip44].areTransactionTimestamped
    )

    indexes.push(vout)
    txs.push(tx.payload)
    paths.push(path)
  }
  const inputs = zip(txs, indexes);
  const additionals = msg.coin === 'BitcoinCash' ? ['abc'] : []

  //sign createPaymentTransaction
  let signedTx = await transport.call(
    'Btc',
    'createPaymentTransactionNew',
    inputs, paths, undefined, outputScriptHex, null, networksUtil[slip44].sigHash, segwit, undefined, additionals
  )
  handleError(signedTx, transport, 'Could not sign transaction with device')

  return {
    serializedTx: signedTx.payload,
    signatures:[]
  }
}

export async function btcSupportsSecureTransfer (): Promise<boolean> {
  return false
}

export function btcSupportsNativeShapeShift (): boolean {
  return false
}

export async function btcSignMessage (wallet: core.BTCWallet, transport: LedgerTransport, msg: core.BTCSignMessage): Promise<core.BTCSignedMessage> {
  const bip32path = core.addressNListToBIP32(msg.addressNList)

  const res = await transport.call('Btc', 'signMessageNew', bip32path, Buffer.from(msg.message).toString("hex"))
  handleError(res, transport, 'Could not sign message with device')
  const v = res.payload['v'] + 27 + 4

  const signature = Buffer.from(v.toString(16) + res.payload['r'] + res.payload['s'], 'hex').toString('hex')

  const address = await btcGetAddress(transport, {
    addressNList: msg.addressNList,
    coin: msg.coin,
    showDisplay: false,
    scriptType: msg.scriptType
  })

  return {
    address,
    signature
  }
}

export async function btcVerifyMessage (msg: core.BTCVerifyMessage): Promise<boolean> {
  const signature = Base64.fromByteArray(core.fromHexString(msg.signature))
  return verify(msg.message, msg.address, signature)
}

export function btcGetAccountPaths (msg: core.BTCGetAccountPaths): Array<core.BTCAccountPath> {
  const slip44 = core.slip44ByCoin(msg.coin)
  const bip49 = {
    coin: msg.coin,
    scriptType: core.BTCInputScriptType.SpendP2SHWitness,
    addressNList: [0x80000000 + 49, 0x80000000 + slip44, 0x80000000 + msg.accountIdx]
  }
  const bip44 = {
    coin: msg.coin,
    scriptType: core.BTCInputScriptType.SpendAddress,
    addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx]
  }
  const bip84 = {
    coin: msg.coin,
    scriptType: core.BTCInputScriptType.SpendWitness,
    addressNList: [0x80000000 + 84, 0x80000000 + slip44, 0x80000000 + msg.accountIdx]
  }

  let paths: Array<core.BTCAccountPath>

  if (segwitCoins.includes(msg.coin))
    paths = [ bip49, bip44, bip84 ]
  else
    paths = [ bip44 ]

  if (msg.scriptType !== undefined)
    paths = paths.filter(path => { return path.scriptType === msg.scriptType })

  return paths
}

export function btcIsSameAccount (msg: Array<core.BTCAccountPath>): boolean {
  return true
}
