import { HDWallet, HDWalletInfo } from '@shapeshiftoss/hdwallet-core'
import { isKeepKey } from '@shapeshiftoss/hdwallet-keepkey'
import { isTrezor } from '@shapeshiftoss/hdwallet-trezor'
import { isLedger } from '@shapeshiftoss/hdwallet-ledger'
import { isPortis } from '@shapeshiftoss/hdwallet-portis'

import { btcTests } from './bitcoin'
import { ethTests } from './ethereum'
import { cosmosTests } from './cosmos'
import { eosTests } from './eos'

import { WalletSuite } from './wallets/suite'

/**
 * We run all the integration tests against every device, even though some
 * devices might not support a given Coin mixin. Tests in the various suites
 * are designed to check for support, and if it's not available, the test is
 * marked as 'passed'. A WalletSuite implementation is therefore expected to
 * assert support for its various attributes (say, support for BTC or ETH), and
 * confirm that in its `selfTest` implementation.
 */

export function integration (suite: WalletSuite): void {
  const name: string = suite.name()

  let wallet: HDWallet
  let info: HDWalletInfo

  describe(`${name}`, () => {
    beforeAll(() => {
      info = suite.createInfo()
    })

    describe('Type Guards', () => {
      beforeAll(async () => {
        wallet = await suite.createWallet()
      })

      it('has only one vendor', () => {
        expect(
          (isKeepKey(wallet) ? 1 : 0) +
          (isTrezor(wallet) ? 1 : 0) +
          (isLedger(wallet) ? 1 : 0) +
          (isPortis(wallet) ? 1 : 0)
        ).toEqual(1)
      })
    })
/*
    describe('ETHWallet', () => {
      beforeAll(async () => {
        wallet = await suite.createWallet('Ethereum')
      })

      ethTests(() => ({wallet, info}))
    })

    describe('BTCWallet', () => {
      beforeAll(async () => {
        wallet = await suite.createWallet('Bitcoin')
      })

      btcTests(() => ({wallet, info}))
    })

    describe('CosmosWallet', () => {
      beforeAll(async () => {
        wallet = await suite.createWallet('Cosmos')
      })

      cosmosTests(() => ({wallet, info}))
    })
*/
    describe('EosWallet', () => {
      beforeAll(async () => {
        wallet = await suite.createWallet('Eos')
      })

      eosTests(() => ({wallet, info}))
    })
/*
    describe('SelfTest', () => {
      beforeAll(async () => {
        wallet = await suite.createWallet()
      })

      suite.selfTest(() => (wallet))
    })
    */
  })
}
