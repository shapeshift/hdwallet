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
import { PortisAdapter, PortisHDWallet, PortisHDWalletInfo, isPortis, info, create } from '@shapeshiftoss/hdwallet-portis'
import * as debug from 'debug'

const log = debug.default('portis')

const portisAppId = 'ff763d3d-9e34-45a1-81d1-caa39b9c64f9'

export function name (): string {
  return 'Portis'
}

const mockPortis = {
  provider: {}
}

async function getDevice (keyring: Keyring) {
  try {
    const portisAdapter = PortisAdapter.useKeyring(keyring, { portis: mockPortis })
    const wallet = await portisAdapter.pairDevice()
    if (wallet)
      console.log('using mockPortis for tests')
    return wallet
  } catch (e) {
  }
  return undefined
}

export async function createWallet (): Promise<HDWallet> {
  // const keyring = new Keyring()

  // const wallet = await getDevice(keyring)

  const wallet = create(mockPortis)

  if (!wallet)
    throw new Error("No Portis wallet found")

  return wallet
}

export function createInfo (): HDWalletInfo {
  return info()
}

export function selfTest (get: () => HDWallet): void {
  let wallet: PortisHDWallet & ETHWallet & HDWallet

  beforeAll(async () => {
    let w = get()
    if (isPortis(w) && supportsETH(w))
      wallet = w
    else
      fail('Wallet is not Portis')
  })

  it('supports Ethereum mainnet', async () => {
    if (!wallet) return
    expect(await wallet.ethSupportsNetwork(1)).toEqual(true)
  })
}
  
