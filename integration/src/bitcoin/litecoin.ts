import {
  bip32ToAddressNList,
  HDWallet,
  BTCWallet,
  supportsBTC,
  BTCInputScriptType,
  Coin
} from '@shapeshiftoss/hdwallet-core'

import { each } from '../utils'

const MNEMONIC12_NOPIN_NOPASSPHRASE = 'alcohol woman abuse must during monitor noble actual mixed trade anger aisle'

const TIMEOUT = 60 * 1000

/**
 *  Main integration suite for testing BTCWallet implementations' Litecoin support.
 */
export function litecoinTests (get: () => HDWallet): void {

  let wallet: BTCWallet & HDWallet

  describe('Litecoin', () => {

    beforeAll(() => {
      let w = get()
      if (supportsBTC(w))
        wallet = w
    })

    beforeEach(async () => {
      if (!wallet) return
      await wallet.wipe()
      await wallet.loadDevice({ mnemonic: MNEMONIC12_NOPIN_NOPASSPHRASE, label: 'test', skipChecksum: true })
    }, TIMEOUT)

    test('btcGetAddress()', async () => {
      if (!wallet) return
      if (!await wallet.btcSupportsCoin('Litecoin')) return
      await each([
        ['Show', 'Litecoin', "m/44'/2'/0'/0/0", BTCInputScriptType.SpendAddress,     'LYXTv5RdsPYKC4qGmb6x6SuKoFMxUdSjLQ'],
        ['Tell', 'Litecoin', "m/49'/2'/0'/0/0", BTCInputScriptType.SpendP2SHWitness, 'MFoQRU1KQq365Sy3cXhix3ygycEU4YWB1V'],
        ['Tell', 'Litecoin', "m/84'/2'/0'/0/0", BTCInputScriptType.SpendWitness,     'ltc1qf6pwfkw4wd0fetq2pfrwzlfknskjg6nyvt6ngv'],
      ], async (args) => {
        let mode = args[0] as string
        let coin = args[1] as Coin
        let path = args[2] as string
        let scriptType = args[3] as BTCInputScriptType
        let expected = args[4] as string

        if (!await wallet.btcSupportsScriptType(coin, scriptType)) return
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

    test('btcGetAccountPaths()', async () => {
      await each([
        ['Litecoin',    1, BTCInputScriptType.SpendAddress],
        ['Litecoin',    1, BTCInputScriptType.SpendP2SHWitness],
        ['Litecoin',    1, BTCInputScriptType.SpendWitness],
      ], async (args) => {
        let coin = args[0] as Coin
        let accountIdx = args[1] as number
        let scriptType = args[2] as BTCInputScriptType
        if (!wallet) return
        if (!await wallet.btcSupportsCoin(coin))
          return
        if (!await wallet.btcSupportsScriptType(coin, scriptType))
          return
        let paths = wallet.btcGetAccountPaths({ coin: coin, accountIdx: accountIdx, scriptType: scriptType })
        expect(paths.length > 0)
      })
    }, TIMEOUT)

    test('btcIsSameAccount()', async () => {
      if (!wallet) return
      [0, 1, 9].forEach(idx => {
        let paths = wallet.btcGetAccountPaths({ coin: 'Litecoin', accountIdx: idx })
        expect(typeof wallet.btcIsSameAccount(paths) === typeof true).toBeTruthy()
      })
    }, TIMEOUT)

  })
}
