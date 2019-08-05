import {
  BTCWallet,
  BTCGetAddress,
  BTCSignTx,
  BTCSignTxInput,
  BTCSignTxOutput,
  BTCSignedTx,
  BTCGetAccountPaths,
  BTCAccountPath,
  BTCSignMessage,
  BTCSignedMessage,
  BTCVerifyMessage,
  BTCInputScriptType,
  BTCOutputScriptType,
  Constructor,
  fromHexString,
  toHexString,
  arrayify,
  Event,
  Coin,
  Events,
  DEFAULT_TIMEOUT,
  LONG_TIMEOUT,
  base64toHEX,
  slip44ByCoin,
  satsFromStr,
 } from '@shapeshiftoss/hdwallet-core'

import { KeepKeyTransport } from './transport'

import * as Messages from '@keepkey/device-protocol/lib/messages_pb'
import * as Types from '@keepkey/device-protocol/lib/types_pb'
import * as Exchange from '@keepkey/device-protocol/lib/exchange_pb'

import {
  toUTF8Array,
  translateInputScriptType,
  translateOutputScriptType
} from './utils'

// FIXME: load this from the device's coin table, or from some static features
// table... instead of, you know, adding another God-forsaken coin table.
// :facepalm:
const supportedCoins = [
  'Bitcoin',
  'Testnet',
  'BitcoinCash',
  'BitcoinGold',
  'Litecoin',
  'Dash',
  'Dogecoin'
]

const segwitCoins = [
  'Bitcoin',
  'Testnet',
  'BitcoinGold',
  'Litecoin',
]

function legacyAccount (slip44: number, accountIdx: number): BTCAccountPath {
  return {
    scriptType: BTCInputScriptType.SpendAddress,
    addressNList: [ 0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + accountIdx ]
  }
}

function segwitAccount (slip44: number, accountIdx: number): BTCAccountPath {
  return {
    scriptType: BTCInputScriptType.SpendP2SHWitness,
    addressNList: [ 0x80000000 + 49, 0x80000000 + slip44, 0x80000000 + accountIdx ]
  }
}

function segwitNativeAccount (slip44: number, accountIdx: number): BTCAccountPath {
  return {
    scriptType: BTCInputScriptType.SpendWitness,
    addressNList: [ 0x80000000 + 84, 0x80000000 + slip44, 0x80000000 + accountIdx ]
  }
}

function packVarint (n: number): string {
  if (n < 253)
    return n.toString(16).padStart(2, '0')
  else if (n < 0xffff)
    return 'FD' + n.toString(16).padStart(4, '0')
  else if (n < 0xffffffff)
    return 'FE' + n.toString(16).padStart(8, '0')
  else
    return 'FF' + n.toString(16).padStart(16, '0')
}

function prepareSignTx (
  coin: Coin,
  inputs: Array<BTCSignTxInput>,
  outputs: Array<BTCSignTxOutput>,
): any {
  const unsignedTx = new Types.TransactionType()
  unsignedTx.setInputsCnt(inputs.length)
  unsignedTx.setOutputsCnt(outputs.length)

  inputs.forEach((input, i) => {
    const utxo = new Types.TxInputType()
    utxo.setPrevHash(fromHexString(input.txid))
    utxo.setPrevIndex(input.vout)
    if (input.sequence !== undefined) utxo.setSequence(input.sequence)
    utxo.setScriptType(translateInputScriptType(input.scriptType))
    utxo.setAddressNList(input.addressNList)
    utxo.setAmount(input.amount)
    unsignedTx.addInputs(utxo, i)
  })

  outputs.forEach((o, k) => {
    const output: BTCSignTxOutput = o
    const newOutput = new Types.TxOutputType()
    newOutput.setAmount(output.amount)
    newOutput.setScriptType(translateOutputScriptType(output.scriptType || BTCOutputScriptType.PayToAddress))
    if (output.exchangeType) {
      // convert the base64 encoded signedExchangeResponse message into the correct object
      const signedHex = base64toHEX(output.exchangeType.signedExchangeResponse)
      const signedExchange = Exchange.SignedExchangeResponse.deserializeBinary(arrayify(signedHex))

      // decode the deposit amount from a little-endian Uint8Array into an unsigned uint64
      let depAmt = signedExchange.getResponsev2().getDepositAmount_asU8()
      let val = 0
      for (let jj = depAmt.length - 1; jj >= 0; jj--) {
        val += depAmt[jj] * Math.pow(2,(8 * (depAmt.length - jj - 1)))
        // TODO validate is uint64
      }
      const outExchangeType = new Types.ExchangeType()
      outExchangeType.setSignedExchangeResponse(signedExchange)
      outExchangeType.setWithdrawalCoinName(output.exchangeType.withdrawalCoinName)
      outExchangeType.setWithdrawalAddressNList(output.exchangeType.withdrawalAddressNList)
      outExchangeType.setWithdrawalScriptType(translateInputScriptType(
        output.exchangeType.withdrawalScriptType || BTCInputScriptType.SpendAddress))
      outExchangeType.setReturnAddressNList(output.exchangeType.returnAddressNList)
      outExchangeType.setReturnScriptType(translateInputScriptType(
        output.exchangeType.returnScriptType || BTCInputScriptType.SpendAddress))
      newOutput.setAmount(val)
      newOutput.setAddress(signedExchange.toObject().responsev2.depositAddress.address)
      newOutput.setScriptType(Types.OutputScriptType.PAYTOADDRESS)
      newOutput.setAddressType(3)
      newOutput.setExchangeType(outExchangeType)
    } else if (output.isChange) {
      newOutput.setAddressNList(output.addressNList)
      newOutput.setAddressType(Types.OutputAddressType.CHANGE)
    } else {
      newOutput.setAddress(output.address)
      newOutput.setAddressType(Types.OutputAddressType.SPEND)
    }
    unsignedTx.addOutputs(newOutput, k)
  })

  const txmap = {} // Create a map of transactions by txid needed for the KeepKey signing flow.
  txmap['unsigned'] = unsignedTx

  const forceBip143Coins = ['BitcoinGold', 'BitcoinCash', 'BitcoinSV']
  if (forceBip143Coins.includes(coin))
    return txmap

  inputs.forEach(inputTx => {
    if (inputTx.txid in txmap)
      return

    if (inputTx.scriptType === BTCInputScriptType.SpendP2SHWitness ||
        inputTx.scriptType === BTCInputScriptType.SpendWitness ||
        inputTx.scriptType === BTCInputScriptType.External)
      return

    if (!inputTx.tx)
      throw new Error("non-segwit inputs must have the associated prev tx")

    const tx = new Types.TransactionType()
    tx.setVersion(inputTx.tx.version)
    tx.setLockTime(inputTx.tx.locktime)
    tx.setInputsCnt(inputTx.tx.vin.length)
    tx.setOutputsCnt(inputTx.tx.vout.length)

    inputTx.tx.vin.forEach((vin, i) => {
      const txInput = new Types.TxInputType()
      if (vin.coinbase !== undefined) {
        txInput.setPrevHash(fromHexString("\0".repeat(64)))
        txInput.setPrevIndex(0xffffffff)
        txInput.setScriptSig(fromHexString(vin.coinbase))
        txInput.setSequence(vin.sequence)
      } else {
        txInput.setPrevHash(fromHexString(vin.txid))
        txInput.setPrevIndex(vin.vout)
        txInput.setScriptSig(fromHexString(vin.scriptSig.hex))
        txInput.setSequence(vin.sequence)
      }
      tx.addInputs(txInput, i)
    })

    inputTx.tx.vout.forEach((vout, i) => {
      const txOutput = new Types.TxOutputBinType()
      txOutput.setAmount(satsFromStr(vout.value))
      txOutput.setScriptPubkey(fromHexString(vout.scriptPubKey.hex))
      tx.addBinOutputs(txOutput, i)
    })

    if (coin === "Dash") {
      let dip2_type: number = inputTx.tx.type
      // DIP2 Special Tx with payload
      if (inputTx.tx.version === 3 && dip2_type !== 0) {
        if (!inputTx.tx.extraPayload || !inputTx.tx.extraPayloadSize)
          throw new Error("Payload missing in DIP2 transaction")

        if (inputTx.tx.extraPayloadSize * 2 !== inputTx.tx.extraPayload.length)
          throw new Error("DIP2 Payload length mismatch")

        tx.setExtraData(fromHexString(packVarint(inputTx.tx.extraPayloadSize) + inputTx.tx.extraPayload))
      }

      // Trezor (and therefore KeepKey) firmware doesn't understand the
      // split of version and type, so let's mimic the old serialization
      // format
      tx.setVersion(tx.getVersion() | dip2_type << 16)
    }

    txmap[inputTx.txid] = tx
  })

  return txmap
}

async function ensureCoinSupport(wallet: BTCWallet, coin: Coin): Promise<void> {
  if (!supportedCoins.includes(coin))
    throw new Error(`'${coin}' not yet supported in HDWalletKeepKey`)

  if (!wallet.btcSupportsCoin(coin))
    throw new Error(`'${coin} is not supported in this firmware version`)
}

 /**
  * Mixin Constructor that adds BTC support to a KeepKeyHDWallet
  */
export function KeepKeyBTCWallet<TBase extends Constructor>(Base: TBase) {
  return class KeepKeyBTCWallet extends Base implements BTCWallet {
    _supportsBTC: boolean = true
    transport: KeepKeyTransport

    public async btcSupportsCoin (coin: Coin): Promise<boolean> {
      // FIXME: inspect the CoinTable to determine which coins are actually supported by the device.
      return supportedCoins.includes(coin)
    }

    public async btcSupportsScriptType (coin: Coin, scriptType: BTCInputScriptType): Promise<boolean> {
      if (!supportedCoins.includes(coin))
        return false
      if (!segwitCoins.includes(coin) && scriptType === BTCInputScriptType.SpendP2SHWitness)
        return false
      if (!segwitCoins.includes(coin) && scriptType === BTCInputScriptType.SpendWitness)
        return false
      return true
    }

    public async btcGetAddress (msg: BTCGetAddress): Promise<string> {
      await ensureCoinSupport(this, msg.coin)

      const addr = new Messages.GetAddress()
      addr.setAddressNList(msg.addressNList)
      addr.setCoinName(msg.coin)
      addr.setShowDisplay(msg.showDisplay || false)
      addr.setScriptType(translateInputScriptType(msg.scriptType || BTCInputScriptType.SpendAddress))

      const response = await this.transport.call(Messages.MessageType.MESSAGETYPE_GETADDRESS, addr, LONG_TIMEOUT) as Event

      if(response.message_type === Events.FAILURE) throw response
      if(response.message_type === Events.CANCEL) throw response

      const btcAddress = response.proto as Messages.Address
      return btcAddress.getAddress()
    }

    public async btcSignTx (msg: BTCSignTx): Promise<BTCSignedTx> {
      return this.transport.lockDuring(async () => {
        await ensureCoinSupport(this, msg.coin)
        const txmap = prepareSignTx(msg.coin, msg.inputs, msg.outputs)

        // Prepare and send initial message
        const tx = new Messages.SignTx()
        tx.setInputsCount(msg.inputs.length)
        tx.setOutputsCount(msg.outputs.length)
        tx.setCoinName(msg.coin)
        if (msg.version !== undefined) tx.setVersion(msg.version)
        tx.setLockTime(msg.locktime || 0)

        let responseType: number
        let response: any
        const { message_enum, proto } = await this.transport.call(Messages.MessageType.MESSAGETYPE_SIGNTX, tx, LONG_TIMEOUT, /*omitLock=*/true) as Event // 5 Minute timeout
        responseType = message_enum
        response = proto

        // Prepare structure for signatures
        const signatures: string[] = new Array(msg.inputs.length).fill(null)
        let serializedTx: string = ''

        try {
          // Begin callback loop
          while (true) {
            if (responseType === Messages.MessageType.MESSAGETYPE_FAILURE) {
              const errorResponse = response as Messages.Failure
              throw new Error(`Signing failed: ${errorResponse.getMessage()}`)
            }

            if (responseType !== Messages.MessageType.MESSAGETYPE_TXREQUEST) {
              throw new Error(`Unexpected message type: ${responseType}`)
            }

            let txRequest = response as Messages.TxRequest

            // If there's some part of signed transaction, add it
            if (txRequest.hasSerialized() && txRequest.getSerialized().hasSerializedTx()) {
              serializedTx += toHexString(txRequest.getSerialized().getSerializedTx_asU8())
            }

            if (txRequest.hasSerialized() && txRequest.getSerialized().hasSignatureIndex()) {
              if (signatures[txRequest.getSerialized().getSignatureIndex()] !== null) {
                throw new Error(`Signature for index ${txRequest.getSerialized().getSignatureIndex()} already filled`)
              }
              signatures[txRequest.getSerialized().getSignatureIndex()] = toHexString(txRequest.getSerialized().getSignature_asU8())
            }

            if (txRequest.getRequestType() === Types.RequestType.TXFINISHED) {
              // Device didn't ask for more information, finish workflow
              break
            }

            let currentTx: Types.TransactionType = null
            let msg: Types.TransactionType = null
            let txAck: Messages.TxAck = null

            // Device asked for one more information, let's process it.
            if (txRequest.hasDetails() && !txRequest.getDetails().hasTxHash()) {
              currentTx = txmap['unsigned']
            } else {
              currentTx = txmap[toHexString(txRequest.getDetails().getTxHash_asU8())]
            }

            if (txRequest.getRequestType() === Types.RequestType.TXMETA) {
              msg = new Types.TransactionType()
              msg.setVersion(currentTx.getVersion())
              msg.setLockTime(currentTx.getLockTime())
              msg.setInputsCnt(currentTx.getInputsCnt())
              if (txRequest.getDetails().hasTxHash()) {
                msg.setOutputsCnt(currentTx.getBinOutputsList().length)
              } else {
                msg.setOutputsCnt(currentTx.getOutputsList().length)
              }
              if (currentTx.hasExtraData()) {
                msg.setExtraDataLen(currentTx.getExtraData_asU8().length)
              } else {
                msg.setExtraDataLen(0)
              }
              txAck = new Messages.TxAck()
              txAck.setTx(msg)
              let message = await this.transport.call(Messages.MessageType.MESSAGETYPE_TXACK, txAck, LONG_TIMEOUT, /*omitLock=*/true) as Event // 5 Minute timeout
              responseType = message.message_enum
              response = message.proto
              continue
            }

            if (txRequest.getRequestType() === Types.RequestType.TXINPUT) {
              msg = new Types.TransactionType()
              msg.setInputsList([currentTx.getInputsList()[txRequest.getDetails().getRequestIndex()]])
              txAck = new Messages.TxAck()
              txAck.setTx(msg)
              let message = await this.transport.call(Messages.MessageType.MESSAGETYPE_TXACK, txAck, LONG_TIMEOUT, /*omitLock=*/true) as Event // 5 Minute timeout
              responseType = message.message_enum
              response = message.proto
              continue
            }

            if (txRequest.getRequestType() === Types.RequestType.TXOUTPUT) {
              msg = new Types.TransactionType()
              if (txRequest.getDetails().hasTxHash()) {
                msg.setBinOutputsList([currentTx.getBinOutputsList()[txRequest.getDetails().getRequestIndex()]])
              } else {
                msg.setOutputsList([currentTx.getOutputsList()[txRequest.getDetails().getRequestIndex()]])
                msg.setOutputsCnt(1)
              }
              txAck = new Messages.TxAck()
              txAck.setTx(msg)
              let message = await this.transport.call(Messages.MessageType.MESSAGETYPE_TXACK, txAck, LONG_TIMEOUT, /*omitLock=*/true) as Event // 5 Minute timeout
              responseType = message.message_enum
              response = message.proto
              continue
            }

            if (txRequest.getRequestType() === Types.RequestType.TXEXTRADATA) {
              let offset = txRequest.getDetails().getExtraDataOffset()
              let length = txRequest.getDetails().getExtraDataLen()
              msg = new Types.TransactionType()
              msg.setExtraData(currentTx.getExtraData_asU8().slice(offset, offset + length))
              txAck = new Messages.TxAck()
              txAck.setTx(msg)
              let message = await this.transport.call(Messages.MessageType.MESSAGETYPE_TXACK, txAck, LONG_TIMEOUT, /*omitLock=*/true) as Event // 5 Minute timeout
              responseType = message.message_enum
              response = message.proto
              continue
            }
          }
        } catch (error) {
          console.error({ error })
          throw new Error('Failed to sign BTC transaction')
        }

        if (signatures.includes(null)) {
          throw new Error('Some signatures are missing!')
        }

        return {
          signatures: signatures,
          serializedTx: serializedTx
        }
      })
    }

    public async btcSupportsSecureTransfer (): Promise<boolean> {
      return true
    }

    public async btcSupportsNativeShapeShift (): Promise<boolean> {
      return true
    }

    public async btcSignMessage (msg: BTCSignMessage): Promise<BTCSignedMessage> {
      await ensureCoinSupport(this, msg.coin)
      const sign = new Messages.SignMessage()
      sign.setAddressNList(msg.addressNList)
      sign.setMessage(toUTF8Array(msg.message))
      sign.setCoinName(msg.coin || 'Bitcoin')
      sign.setScriptType(translateInputScriptType(msg.scriptType || BTCInputScriptType.SpendAddress))
      const event = await this.transport.call(Messages.MessageType.MESSAGETYPE_SIGNMESSAGE, sign, LONG_TIMEOUT) as Event
      const messageSignature = event.proto as Messages.MessageSignature
      return {
        address: messageSignature.getAddress(),
        signature: toHexString(messageSignature.getSignature_asU8())
      }
    }

    public async btcVerifyMessage (msg: BTCVerifyMessage): Promise<boolean> {
      await ensureCoinSupport(this, msg.coin)
      const verify = new Messages.VerifyMessage()
      verify.setAddress(msg.address)
      verify.setSignature(arrayify('0x' + msg.signature))
      verify.setMessage(toUTF8Array(msg.message))
      verify.setCoinName(msg.coin)
      let event = await this.transport.call(Messages.MessageType.MESSAGETYPE_VERIFYMESSAGE, verify)
      const success = event.proto as Messages.Success
      return success.getMessage() === "Message verified"
    }

    public btcGetAccountPaths (msg: BTCGetAccountPaths): Array<BTCAccountPath> {
      const slip44 = slip44ByCoin(msg.coin)
      const bip44 = legacyAccount(slip44, msg.accountIdx)
      const bip49 = segwitAccount(slip44, msg.accountIdx)
      const bip84 = segwitNativeAccount(slip44, msg.accountIdx)

      // For BTC Forks
      const btcLegacy = legacyAccount(slip44ByCoin('Bitcoin'), msg.accountIdx)
      const btcSegwit = segwitAccount(slip44ByCoin('Bitcoin'), msg.accountIdx)
      const btcSegwitNative = segwitNativeAccount(slip44ByCoin('Bitcoin'), msg.accountIdx)

      // For BCH Forks
      const bchLegacy = legacyAccount(slip44ByCoin('BitcoinCash'), msg.accountIdx)

      let paths: Array<BTCAccountPath> = {
        'Bitcoin':  [bip44, bip49, bip84],
        'Litecoin': [bip44, bip49, bip84],
        'Dash': [bip44],
        'Dogecoin': [bip44],
        'Testnet': [bip44, bip49, bip84],
        'BitcoinCash': [bip44, btcLegacy],
        'BitcoinSV': [bip44, bchLegacy, btcLegacy],
        'BitcoinGold': [bip44, bip49, bip84, btcLegacy, btcSegwit, btcSegwitNative],
      }[msg.coin] || []

      if (msg.scriptType !== undefined)
        paths = paths.filter(path => { return path.scriptType === msg.scriptType })

      return paths
    }

    public btcIsSameAccount (msg: Array<BTCAccountPath>): boolean {
      if (msg.length < 1)
        return false

      // TODO: mixed-mode segwit was added in v6.0.2
      // https://github.com/keepkey/keepkey-firmware/pull/81
      // if (firmware_version.lt('6.0.2') && msg.length > 1)
      //  return false

      if (msg.length > 3)
        return false

      const account0 = msg[0]
      if (account0.addressNList.length != 3)
        return false

      // Purpose must be BIP44 / BIP49 / BIP84
      const purpose = account0.addressNList[0]
      if (![0x80000000 + 44, 0x80000000 + 49, 0x80000000 + 84].includes(purpose))
        return false

      // Make sure Purpose and ScriptType match
      const purposeForScriptType = new Map()
      purposeForScriptType.set(BTCInputScriptType.SpendAddress,     0x80000000 + 44)
      purposeForScriptType.set(BTCInputScriptType.SpendP2SHWitness, 0x80000000 + 49)
      purposeForScriptType.set(BTCInputScriptType.SpendWitness,     0x80000000 + 84)
      if (purposeForScriptType[account0.scriptType] !== purpose)
        return false

      // Coin must be hardened
      const slip44 = account0.addressNList[1]
      if (slip44 < 0x80000000)
        return false

      // Account Idx must be hardened
      const idx = account0.addressNList[2]
      if (idx < 0x80000000)
        return false

      // Accounts must have the same SLIP44 and Account Idx, but may have differing
      // purpose fields (so long as they're BIP44/BIP49/BIP84)
      if (msg.find(path => {
          if (path.addressNList.length != 3)
            return true

          if (![0x80000000 + 44, 0x80000000 + 49, 0x80000000 + 84].includes(path.addressNList[0]))
            return true

          if (purposeForScriptType[path.scriptType] !== path.addressNList[0])
            return true

          if (path.addressNList[1] != slip44)
            return true

          if (path.addressNList[2] != idx)
            return true
          })) {
        return false
      }

      return true
    }
  }
}
