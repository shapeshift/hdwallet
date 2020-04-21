import {
  EosPublicKeyKind,
} from '@keepkey/device-protocol/lib/messages-eos_pb'

import {
  bip32ToAddressNList,
  HDWallet,
  EosWallet,
  supportsEos,
  EosTx
} from '@shapeshiftoss/hdwallet-core'
import { HDWalletInfo } from '@shapeshiftoss/hdwallet-core/src/wallet'

import {
  toHexString
} from '@shapeshiftoss/hdwallet-core'

import * as tx01_unsigned from './tx01.unsigned.json' 


const MNEMONIC12_NOPIN_NOPASSPHRASE = 'alcohol woman abuse must during monitor noble actual mixed trade anger aisle'

const TIMEOUT = 60 * 1000

/**
 *  Main integration suite for testing eos wallet.
 */
export function eosTests (get: () => {wallet: HDWallet, info: HDWalletInfo}): void {

  let wallet: EosWallet & HDWallet

  describe('Eos', () => {

    beforeAll(async () => {
      const { wallet: w } = get()
      if (supportsEos(w))
        wallet = w
    })

    beforeEach(async () => {
      if (!wallet) return
      await wallet.wipe()
      await wallet.loadDevice({ mnemonic: MNEMONIC12_NOPIN_NOPASSPHRASE, label: 'test', skipChecksum: true })
    }, TIMEOUT)

    test.skip('eosGetAccountPaths()', () => {
      if (!wallet) return
      let paths = wallet.eosGetAccountPaths({ accountIdx: 0 })
      expect(paths.length > 0).toBe(true)
      expect(paths[0].addressNList[0] > 0x80000000).toBe(true)
      paths.forEach(path => {
        let curAddr = path.addressNList.join()
        let nextAddr = wallet.eosNextAccountPath(path).addressNList.join()
        expect(
          nextAddr === undefined
          || nextAddr !== curAddr
        ).toBeTruthy()
      })
    }, TIMEOUT)

    test.skip('eosGetPublicKey()', async () => {
      if (!wallet) return
      expect(await wallet.eosGetPublicKey({
                       addressNList: bip32ToAddressNList("m/44'/194'/0'/0/0"),
                       showDisplay: false,
                       kind: EosPublicKeyKind.EOS}))
        .toEqual('EOS4u6Sfnzj4Sh2pEQnkXyZQJqH3PkKjGByDCbsqqmyq6PttM9KyB')
    }, TIMEOUT)

    test('eosSignTx()', async () => {
      if (!wallet) return
      let res = await wallet.eosSignTx({
        addressNList: bip32ToAddressNList("m/44'/194'/0'/0/0"),
        chain_id: 'cf057bbfb72640471fd910bcb67639c22df9f92470936cddc1ade0e2f2e7dc4f',
        tx: (tx01_unsigned as unknown) as EosTx,
      })
      console.log("sigV = %d", res.signatureV)    
      console.log("sigR = %s", toHexString(res.signatureR))
      console.log("sigS = %s", toHexString(res.signatureS))
      console.log("hash = %s", toHexString(res.hash))
      expect(res.signatureV).toEqual(31)
      expect(toHexString(res.signatureR)).toEqual("729e0a94e5a587d7f10001214fc017e56c8753ff0fc785eb3e91b3f471d58864")
      expect(toHexString(res.signatureS)).toEqual("532ee29e14bc925b37dec2cab72863b5bf82af581f2250b5149722582b56998d")
      expect(toHexString(res.hash)).toEqual("a862b70cf84b68b1824eac84b64c122fdd1bf580f955262fcf083a9f495f7c56")
//      console.log("resp")
//      console.log(res)
    }, TIMEOUT)
  })
}

