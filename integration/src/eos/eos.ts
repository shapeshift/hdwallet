import {
  bip32ToAddressNList,
  HDWallet,
  EosWallet,
  supportsEos,
} from '@shapeshiftoss/hdwallet-core'
import { HDWalletInfo } from '@shapeshiftoss/hdwallet-core/src/wallet'

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

    test('eosGetAccountPaths()', () => {
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

    test('eosGetPublicKey()', async () => {
      if (!wallet) return
      expect(await wallet.eosGetPublicKey({
                       addressNList: bip32ToAddressNList("m/44'/194'/0'/0/0"),
                       showDisplay: false,
                       kind: true}))
        .toEqual('EOS4u6Sfnzj4Sh2pEQnkXyZQJqH3PkKjGByDCbsqqmyq6PttM9KyB')
    }, TIMEOUT)

    test('eosSignTxTransferToken()', async () => {
      if (!wallet) return

      let res = await wallet.eosSign({
        tx: (tx01_unsigned as unknown) as EosTxTransferToken,
        addressNList: bip32ToAddressNList("m/44'/194'/0'/0/0"),
        chain_id: 'cf057bbfb72640471fd910bcb67639c22df9f92470936cddc1ade0e2f2e7dc4f',
        account_number: '1',
        sequence: '0'
      })
/*
        assert isinstance(actionResp, proto.EosSignedTx)
        self.assertEqual(binascii.hexlify(actionResp.signature_r), "25eebc6591e2c06bb0a5ac1a6e7d79a65e5b5ec2c098362676ba88a0921a9daa")
        self.assertEqual(binascii.hexlify(actionResp.signature_s), "2f5f9b0f6a3bfe6981d4db99cfe2ab88329bf86fb04b40a3a8828453e54cef2c")
        self.assertEqual(actionResp.signature_v, 31)
*/
      expect(res).toEqual()
    }, TIMEOUT)
  })

  })
}

