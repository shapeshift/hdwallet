import { HDWallet } from '@shapeshiftoss/hdwallet-core'

import { ethereumTests } from './ethereum'

export function ethTests (get: () => HDWallet): void {
  ethereumTests(get)
}
