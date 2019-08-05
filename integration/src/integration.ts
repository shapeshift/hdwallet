import { HDWallet } from '@shapeshiftoss/hdwallet-core'

import { btcTests } from './bitcoin'
import { ethTests } from './ethereum'

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
  let wallet: HDWallet

  describe(`${suite.name()}`, () => {

    beforeAll(async () => {
      wallet = await suite.createWallet()
    })

    describe('ETHWallet', () => {
      ethTests(() => wallet)
    })

    describe('BTCWallet', () => {
      btcTests(() => wallet)
    })

    describe('SelfTest', () => {
      suite.selfTest(() => wallet)
    })
  })
}
