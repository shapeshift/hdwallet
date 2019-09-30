import {
  Keyring,
  HDWallet,
  BTCWallet,
  ETHWallet,
  Events,
  supportsDebugLink,
  supportsBTC,
  supportsETH,
  bip32ToAddressNList,
  ActionCancelled,
  HDWalletInfo,
  BTCInputScriptType,
} from '@shapeshiftoss/hdwallet-core'
import { PortisAdapter, PortisHDWallet, PortisHDWalletInfo, isPortis, info } from '@shapeshiftoss/hdwallet-portis'
import * as debug from 'debug'

const log = debug.default('portis')

const portisAppId = 'ff763d3d-9e34-45a1-81d1-caa39b9c64f9'

export function name (): string {
  return 'Portis'
}

async function getDevice (keyring: Keyring) {
  try {
    const portisAdapter = PortisAdapter.useKeyring(keyring, { portisAppId })
    const wallet = await portisAdapter.pairDevice()
    if (wallet)
      console.log('using brettcoin app for tests')
    return wallet
  } catch (e) {
  }
  return undefined
}

export async function createWallet (): Promise<HDWallet> {
  const keyring = new Keyring()

  const wallet = await getDevice(keyring)

  if (!wallet)
    throw new Error("No Portis wallet found")

  return wallet
}
  
