import { HDWallet } from '@shapeshift/hdwallet-core'

import { ethereumTests } from './ethereum'

export function ethTests (get: () => HDWallet): void {
  ethereumTests(get)
}
