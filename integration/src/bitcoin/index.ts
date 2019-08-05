import { HDWallet } from '@shapeshiftoss/hdwallet-core'

import { bitcoinTests } from './bitcoin'
import { testnetTests } from './testnet'
import { litecoinTests } from './litecoin'

export function btcTests (get: () => HDWallet): void {
  bitcoinTests(get)
  testnetTests(get)
  litecoinTests(get)
}
