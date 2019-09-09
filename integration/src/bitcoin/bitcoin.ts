import {
  bip32ToAddressNList,
  HDWallet,
  BTCWallet,
  supportsBTC,
  BTCInputScriptType,
  BTCOutputAddressType,
  BTCOutputScriptType,
  Coin,
  BTCWalletInfo,
  infoBTC,
} from '@shapeshiftoss/hdwallet-core'
import { isLedger } from '@shapeshiftoss/hdwallet-ledger'

import { each } from '../utils'

const MNEMONIC12_NOPIN_NOPASSPHRASE = 'alcohol woman abuse must during monitor noble actual mixed trade anger aisle'

const TIMEOUT = 60 * 1000

/**
 *  Main integration suite for testing BTCWallet implementations' Bitcoin support.
 */
export function bitcoinTests (get: () => HDWallet): void {

  let wallet: BTCWallet & HDWallet
  let info: BTCWalletInfo

  describe('Bitcoin', () => {

    beforeAll(() => {
      let w = get()
      if (supportsBTC(w)) {
        wallet = w
        if (!infoBTC(w.info)) {
          throw new Error("wallet info does not _supportsBTCInfo?")
        }
        info = w.info
      }
    })

    beforeEach(async () => {
      if (!wallet) return
      await wallet.wipe()
      await wallet.loadDevice({ mnemonic: MNEMONIC12_NOPIN_NOPASSPHRASE, label: 'test', skipChecksum: true })
    }, TIMEOUT)

    test('btcSupportsCoin()', async () => {
      if (!wallet) return
      expect(wallet.btcSupportsCoin('Bitcoin')).toBeTruthy()
      expect(await info.btcSupportsCoin('Bitcoin')).toBeTruthy()
      expect(wallet.btcSupportsCoin('Testnet')).toBeTruthy()
      expect(await info.btcSupportsCoin('Testnet')).toBeTruthy()
    }, TIMEOUT)

    test('btcGetAddress()', async () => {
      if (!wallet) return
      await each([
        ['Show', 'Bitcoin',  "m/44'/0'/0'/0/0", BTCInputScriptType.SpendAddress,     '1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM'],
        ['Show', 'Bitcoin',  "m/49'/0'/0'/0/0", BTCInputScriptType.SpendP2SHWitness, '3AnYTd2FGxJLNKL1AzxfW3FJMntp9D2KKX'],
        ['Tell', 'Bitcoin',  "m/49'/0'/0'/0/0", BTCInputScriptType.SpendP2SHWitness, '3AnYTd2FGxJLNKL1AzxfW3FJMntp9D2KKX'],
        ['Tell', 'Litecoin', "m/49'/2'/0'/0/0", BTCInputScriptType.SpendP2SHWitness, 'MFoQRU1KQq365Sy3cXhix3ygycEU4YWB1V'],
        ['Tell', 'Dash',     "m/44'/5'/0'/0/0", BTCInputScriptType.SpendAddress,     'XxKhGNv6ECbqVswm9KYcLPQnyWgZ86jJ6Q'],
      ], async (args) => {
        let mode = args[0] as string
        let coin = args[1] as Coin
        let path = args[2] as string
        let scriptType = args[3] as BTCInputScriptType
        let expected = args[4] as string

        if (!await wallet.btcSupportsCoin(coin)) return
        expect(await info.btcSupportsCoin(coin)).toBeTruthy()
        if (!await wallet.btcSupportsScriptType(coin, scriptType)) return
        expect(await info.btcSupportsScriptType(coin, scriptType)).toBeTruthy()
        let res = await wallet.btcGetAddress({
          addressNList: bip32ToAddressNList(path),
          coin: coin,
          showDisplay: mode === 'Show',
          scriptType: scriptType,
          address: expected,
        })
        expect(res).toEqual(expected)
      })
    }, TIMEOUT)

    test('btcSignTx() - p2pkh', async () => {
      if (!wallet) return
      if (isLedger(wallet)) return // FIXME: Expected failure
      let inputs = [{
        addressNList: bip32ToAddressNList("m/0"),
        scriptType: BTCInputScriptType.SpendAddress,
        amount: 390000,
        vout: 0,
        txid: 'd5f65ee80147b4bcc70b75e4bbf2d7382021b871bd8867ef8fa525ef50864882',
        tx: {
          version: 1,
          locktime: 0,
          vin: [{
            vout: 1,
            valueSat: 200000,
            sequence: 4294967295,
            scriptSig: {
              hex: '483045022072ba61305fe7cb542d142b8f3299a7b10f9ea61f6ffaab5dca8142601869d53c0221009a8027ed79eb3b9bc13577ac2853269323434558528c6b6a7e542be46e7e9a820141047a2d177c0f3626fc68c53610b0270fa6156181f46586c679ba6a88b34c6f4874686390b4d92e5769fbb89c8050b984f4ec0b257a0e5c4ff8bd3b035a51709503'
            },
            txid: 'c16a03f1cf8f99f6b5297ab614586cacec784c2d259af245909dedb0e39eddcf'
          }, {
            vout: 1,
            valueSat: 200000,
            sequence: 4294967295,
            scriptSig: {
              hex: '48304502200fd63adc8f6cb34359dc6cca9e5458d7ea50376cbd0a74514880735e6d1b8a4c0221008b6ead7fe5fbdab7319d6dfede3a0bc8e2a7c5b5a9301636d1de4aa31a3ee9b101410486ad608470d796236b003635718dfc07c0cac0cfc3bfc3079e4f491b0426f0676e6643a39198e8e7bdaffb94f4b49ea21baa107ec2e237368872836073668214'
            },
            txid: '1ae39a2f8d59670c8fc61179148a8e61e039d0d9e8ab08610cb69b4a19453eaf'
          }],
          vout: [{
            value: "0.00390000",
            scriptPubKey: {
              hex: '76a91424a56db43cf6f2b02e838ea493f95d8d6047423188ac'
            }
          }]
        },
        hex: "0100000002cfdd9ee3b0ed9d9045f29a252d4c78ecac6c5814b67a29b5f6998fcff1036ac1010000008b483045022072ba61305fe7cb542d142b8f3299a7b10f9ea61f6ffaab5dca8142601869d53c0221009a8027ed79eb3b9bc13577ac2853269323434558528c6b6a7e542be46e7e9a820141047a2d177c0f3626fc68c53610b0270fa6156181f46586c679ba6a88b34c6f4874686390b4d92e5769fbb89c8050b984f4ec0b257a0e5c4ff8bd3b035a51709503ffffffffaf3e45194a9bb60c6108abe8d9d039e0618e8a147911c68f0c67598d2f9ae31a010000008b48304502200fd63adc8f6cb34359dc6cca9e5458d7ea50376cbd0a74514880735e6d1b8a4c0221008b6ead7fe5fbdab7319d6dfede3a0bc8e2a7c5b5a9301636d1de4aa31a3ee9b101410486ad608470d796236b003635718dfc07c0cac0cfc3bfc3079e4f491b0426f0676e6643a39198e8e7bdaffb94f4b49ea21baa107ec2e237368872836073668214ffffffff0170f30500000000001976a91424a56db43cf6f2b02e838ea493f95d8d6047423188ac00000000"
      }]
      let outputs = [{
        address: '1MJ2tj2ThBE62zXbBYA5ZaN3fdve5CPAz1',
        addressType: BTCOutputAddressType.Spend,
        scriptType: BTCOutputScriptType.PayToAddress,
        amount: 390000 - 10000,
        isChange: false
      }]
      let res = await wallet.btcSignTx({
        coin: 'Bitcoin',
        inputs: inputs,
        outputs: outputs,
        version: 1,
        locktime: 0
      })
      expect(res).toEqual({
        serializedTx: "010000000182488650ef25a58fef6788bd71b8212038d7f2bbe4750bc7bcb44701e85ef6d5000000006b4830450221009a0b7be0d4ed3146ee262b42202841834698bb3ee39c24e7437df208b8b7077102202b79ab1e7736219387dffe8d615bbdba87e11477104b867ef47afed1a5ede7810121023230848585885f63803a0a8aecdd6538792d5c539215c91698e315bf0253b43dffffffff0160cc0500000000001976a914de9b2a8da088824e8fe51debea566617d851537888ac00000000",
        signatures: ["30450221009a0b7be0d4ed3146ee262b42202841834698bb3ee39c24e7437df208b8b7077102202b79ab1e7736219387dffe8d615bbdba87e11477104b867ef47afed1a5ede781"]
      })
    }, TIMEOUT)

    test('btcSignMessage()', async () => {
      if (!wallet) return
      let res = await wallet.btcSignMessage({
        addressNList: bip32ToAddressNList("m/44'/0'/0'/0/0"),
        coin: 'Bitcoin',
        scriptType: BTCInputScriptType.SpendAddress,
        message: "Hello World"
      })
      expect(res).toEqual({
        address: "1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM",
        signature: "20a037c911044cd6c851b6508317d8892067b0b62074b2cf1c0df9abd4aa053a3c243ffdc37f64d7af2c857128eafc81947c380995596615e5dcc313a15f512cdd",
      })
    }, TIMEOUT)

    test('btcVerifyMessage()', async () => {
      if (!wallet) return
      let res = await wallet.btcVerifyMessage({
        address: '1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM',
        coin: 'Bitcoin',
        signature: '20a037c911044cd6c851b6508317d8892067b0b62074b2cf1c0df9abd4aa053a3c243ffdc37f64d7af2c857128eafc81947c380995596615e5dcc313a15f512cdd',
        message: 'Hello World',
      })
      expect(res).toBeTruthy()
    }, TIMEOUT)

    test('btcSupportsSecureTransfer()', async () => {
      if (!wallet) return
      expect(typeof (await wallet.btcSupportsSecureTransfer()) === typeof true).toBeTruthy()
      if (await wallet.btcSupportsSecureTransfer()) {
        expect(await info.btcSupportsSecureTransfer()).toBeTruthy()
      }
      // TODO: write a testcase that exercise secure transfer, if the wallet claims to support it.
    }, TIMEOUT)

    test('btcSupportsNativeShapeShift()', async () => {
      if (!wallet) return
      expect(typeof (await wallet.btcSupportsNativeShapeShift()) === typeof true)
      if (await wallet.btcSupportsNativeShapeShift()) {
        expect(await info.btcSupportsNativeShapeShift()).toBeTruthy()
      }
      // TODO: write a testcase that exercises native shapeshift, if the wallet claims to support it.
    }, TIMEOUT)

    test('btcGetAccountPaths()', async () => {
      await each([
        ['Bitcoin',     0, undefined],
        ['Bitcoin',     1, BTCInputScriptType.SpendAddress],
        ['Bitcoin',     3, BTCInputScriptType.SpendP2SHWitness],
        ['Bitcoin',     2, BTCInputScriptType.SpendWitness],
        ['Litecoin',    1, BTCInputScriptType.SpendAddress],
        ['Litecoin',    1, BTCInputScriptType.SpendP2SHWitness],
        ['Dash',        0, BTCInputScriptType.SpendAddress],
        ['Dogecoin',    0, BTCInputScriptType.SpendAddress],
        ['BitcoinCash', 0, BTCInputScriptType.SpendAddress],
        ['BitcoinGold', 0, BTCInputScriptType.SpendAddress],
      ], async (args) => {
        let coin = args[0] as Coin
        let accountIdx = args[1] as number
        let scriptType = args[2] as BTCInputScriptType
        if (!wallet) return
        if (!await wallet.btcSupportsCoin(coin))
          return
        expect(await info.btcSupportsCoin(coin)).toBeTruthy()
        if (!await wallet.btcSupportsScriptType(coin, scriptType))
          return
        expect(await info.btcSupportsScriptType(coin, scriptType)).toBeTruthy()
        let paths = wallet.btcGetAccountPaths({ coin: coin, accountIdx: accountIdx, scriptType: scriptType })
        expect(paths.length > 0).toBeTruthy()
        if (scriptType !== undefined)
          expect(paths.filter(path => { return path.scriptType !== scriptType })).toHaveLength(0)
      })
    }, TIMEOUT)

    test('btcIsSameAccount()', async () => {
      if (!wallet) return
      [0, 1, 9].forEach(idx => {
        let paths = wallet.btcGetAccountPaths({ coin: 'Bitcoin', accountIdx: idx })
        expect(typeof wallet.btcIsSameAccount(paths) === typeof true).toBeTruthy()
      })
    }, TIMEOUT)

  })
}
