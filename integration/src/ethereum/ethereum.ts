import {
  bip32ToAddressNList,
  HDWallet,
  ETHWallet,
  supportsETH
} from '@shapeshiftoss/hdwallet-core'
import { isLedger } from '@shapeshiftoss/hdwallet-ledger'
import { HDWalletInfo } from '@shapeshiftoss/hdwallet-core/src/wallet'

const MNEMONIC12_NOPIN_NOPASSPHRASE = 'alcohol woman abuse must during monitor noble actual mixed trade anger aisle'

const TIMEOUT = 60 * 1000

/**
 *  Main integration suite for testing ETHWallet implementations' Ethereum support.
 */
export function ethereumTests (get: () => {wallet: HDWallet, info: HDWalletInfo}): void {

  let wallet: ETHWallet & HDWallet

  describe('Ethereum', () => {

    beforeAll(async () => {
      const { wallet: w } = get()
      if (supportsETH(w))
        wallet = w
    })

    beforeEach(async () => {
      if (!wallet) return
      await wallet.wipe()
      await wallet.loadDevice({ mnemonic: MNEMONIC12_NOPIN_NOPASSPHRASE, label: 'test', skipChecksum: true })
    }, TIMEOUT)

    test('ethSupportsNetwork()', async () => {
      if (!wallet) return
      expect(typeof await wallet.ethSupportsNetwork(1) === typeof true).toBeTruthy()
    }, TIMEOUT)

    test('ethSupportsNativeShapeShift()', async () => {
      if (!wallet) return
      // TODO: add a test that pays a ShapeShift conduit
      expect(typeof await wallet.ethSupportsNativeShapeShift() === typeof true).toBeTruthy()
    }, TIMEOUT)

    test('ethSupportsSecureTransfer()', async () => {
      if (!wallet) return
      if (await wallet.ethSupportsSecureTransfer()) {
        let account0 = bip32ToAddressNList("m/44'/60'/0'/0/0")
        let account1 = bip32ToAddressNList("m/44'/60'/1'/0/0")
        let account1Addr = await wallet.ethGetAddress({ addressNList: account1, showDisplay: false })
        let res = await wallet.ethSignTx({
          addressNList: account0,
          nonce: "0x01",
          gasPrice: "0x14",
          gasLimit: "0x14",
          value: '0x00',
          to: account1Addr,
          toAddressNList: account1,
          chainId: 1,
          data: ''
        })
        expect(res).toEqual({
          r: '0x2482a45ee0d2851d3ab76a693edd7a393e8bc99422f7857be78a883bc1d60a5b',
          s: '0x18d776bcfae586bf08ecc70f714c9bec8959695a20ef73ad0c28233fdaeb1bd2',
          v: 37,
          serialized: '0xf85d011414946a32030447a4c751e651db903c3513f7e1380c98808025a02482a45ee0d2851d3ab76a693edd7a393e8bc99422f7857be78a883bc1d60a5ba018d776bcfae586bf08ecc70f714c9bec8959695a20ef73ad0c28233fdaeb1bd2'
        })
      }
    }, TIMEOUT)

    test('ethGetAccountPaths()', () => {
      if (!wallet) return
      let paths = wallet.ethGetAccountPaths({ coin: 'Ethereum', accountIdx: 0 })
      expect(paths.length > 0).toBe(true)
      expect(paths[0].hardenedPath[0] > 0x80000000).toBe(true)
      paths.forEach(path => {
        expect(
          wallet.ethNextAccountPath(path) === undefined
          || wallet.ethNextAccountPath(path).addressNList.join() !== path.addressNList.join()
        ).toBeTruthy()
      })
    }, TIMEOUT)

    test('ethGetAddress()', async () => {
      if (!wallet) return
      expect(await wallet.ethGetAddress({
                       addressNList: bip32ToAddressNList("m/44'/60'/0'/0/0"),
                       showDisplay: false }))
        .toEqual('0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8')
    }, TIMEOUT)

    test('ethSignTx() - ETH', async () => {
      if (!wallet) return
      let res = await wallet.ethSignTx({
          addressNList: bip32ToAddressNList("m/44'/60'/0'/0/0"),
          nonce: "0x01",
          gasPrice: "0x1dcd65000",
          gasLimit: "0x5622",
          value: '0x2c68af0bb14000',
          to: "0x12eC06288EDD7Ae2CC41A843fE089237fC7354F0",
          chainId: 1,
          data: ""
        })
      expect(res).toEqual({
        r: '0x63db3dd3bf3e1fe7dde1969c0fc8850e34116d0b501c0483a0e08c0f77b8ce0a',
        s: '0x28297d012cccf389f6332415e96ee3fc0bbf8474d05f646e029cd281a031464b',
        v: 38,
        serialized: '0xf86b018501dcd650008256229412ec06288edd7ae2cc41a843fe089237fc7354f0872c68af0bb140008026a063db3dd3bf3e1fe7dde1969c0fc8850e34116d0b501c0483a0e08c0f77b8ce0aa028297d012cccf389f6332415e96ee3fc0bbf8474d05f646e029cd281a031464b'
      })
    }, TIMEOUT)

    test('ethSignTx() - ERC20', async () => {
      if (!wallet) return
      let res = await wallet.ethSignTx({
          addressNList: bip32ToAddressNList("m/44'/60'/0'/0/0"),
          nonce: "0x01",
          gasPrice: "0x14",
          gasLimit: "0x14",
          value: '0x00',
          to: "0x41e5560054824ea6b0732e656e3ad64e20e94e45",
          chainId: 1,
          data: '0x' + 'a9059cbb000000000000000000000000' + '1d8ce9022f6284c3a5c317f8f34620107214e545' + '00000000000000000000000000000000000000000000000000000002540be400',
        })
      expect(res).toEqual({
        r: '0x1238fd332545415f09a01470350a5a20abc784dbf875cf58f7460560e66c597f',
        s: '0x10efa4dd6fdb381c317db8f815252c2ac0d2a883bd364901dee3dec5b7d3660a',
        v: 37,
        serialized: '0xf8a20114149441e5560054824ea6b0732e656e3ad64e20e94e4580b844a9059cbb0000000000000000000000001d8ce9022f6284c3a5c317f8f34620107214e54500000000000000000000000000000000000000000000000000000002540be40025a01238fd332545415f09a01470350a5a20abc784dbf875cf58f7460560e66c597fa010efa4dd6fdb381c317db8f815252c2ac0d2a883bd364901dee3dec5b7d3660a'
      })
    }, TIMEOUT)

    test('ethSignMessage()', async () => {
      if (!wallet) return
      if (isLedger(wallet)) return // FIXME: Expected failure
      let res = await wallet.ethSignMessage({
        addressNList: bip32ToAddressNList("m/44'/60'/0'/0/0"),
        message: 'Hello World'
      })
      expect(res.address).toEqual('0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8')
      expect(res.signature).toEqual('0x29f7212ecc1c76cea81174af267b67506f754ea8c73f144afa900a0d85b24b21319621aeb062903e856352f38305710190869c3ce5a1425d65ef4fa558d0fc251b')
    }, TIMEOUT)

    test('ethVerifyMessage()', async () => {
      if (!wallet) return
      let res = await wallet.ethVerifyMessage({
        address: '0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8',
        message: 'Hello World',
        signature: '0x29f7212ecc1c76cea81174af267b67506f754ea8c73f144afa900a0d85b24b21319621aeb062903e856352f38305710190869c3ce5a1425d65ef4fa558d0fc251b'
      })
      expect(res).toBeTruthy()
    }, TIMEOUT)

  })
}
