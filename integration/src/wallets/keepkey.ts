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
} from '@shapeshiftoss/hdwallet-core'
import { KeepKeyHDWallet, KeepKeyHDWalletInfo, isKeepKey } from '@shapeshiftoss/hdwallet-keepkey'
import { NodeWebUSBKeepKeyAdapter } from '@shapeshiftoss/hdwallet-keepkey-nodewebusb'
import { TCPKeepKeyAdapter } from '@shapeshiftoss/hdwallet-keepkey-tcp'
import * as debug from 'debug'

const log = debug.default('keepkey')

const TIMEOUT = 60 * 1000

export function name (): string {
  return 'KeepKey'
}

async function getDevice (keyring: Keyring) {
  try {
    const keepkeyAdapter = NodeWebUSBKeepKeyAdapter.useKeyring(keyring)
    let wallet = await keepkeyAdapter.pairDevice(undefined, true)
    if (wallet)
      console.log("Using attached WebUSB KeepKey for tests")
    return wallet
  } catch (e) {
  }
  return undefined
}

async function getEmulator (keyring: Keyring) {
  try {
    const tcpAdapter = TCPKeepKeyAdapter.useKeyring(keyring)
    let wallet = await tcpAdapter.pairDevice("http://localhost:5000")
    if (wallet)
      console.log("Using KeepKey Emulator for tests")
    return wallet
  } catch (e) {
  }
  return undefined
}

let autoButton = true

export function createInfo (): HDWalletInfo {
  return new KeepKeyHDWalletInfo()
}

export async function createWallet (): Promise<HDWallet> {
  const keyring = new Keyring()

  let wallet = await getDevice(keyring) || await getEmulator(keyring)

  if (!wallet)
    throw new Error("No suitable test KeepKey found")

  wallet.transport.on(Events.BUTTON_REQUEST, async () => {
    if (autoButton && supportsDebugLink(wallet)) {
      await wallet.pressYes()
    }
  })

  wallet.transport.onAny((event: string[], ...values: any[]) => {
    //console.info(event, ...values)
  })

  return wallet
}

export function selfTest (get: () => HDWallet): void {
  let wallet: KeepKeyHDWallet & BTCWallet & ETHWallet & HDWallet

  beforeAll(async () => {
    let w = get()
    if (isKeepKey(w) && supportsBTC(w) && supportsETH(w))
      wallet = w
    else
      fail('Wallet is not a KeepKey')
  })

  it('supports Ethereum mainnet', async () => {
    if (!wallet) return
    expect(await wallet.ethSupportsNetwork(1)).toEqual(true)
  })

  it('supports ShapeShift', async () => {
    if (!wallet) return
    expect(await wallet.ethSupportsNativeShapeShift()).toEqual(true)
  })

  it('supports Secure Transfer', async () => {
    if (!wallet) return
    expect(await wallet.ethSupportsSecureTransfer()).toEqual(true)
  })

  it('uses the same BIP32 paths for ETH as the KeepKey Client', () => {
    if (!wallet) return
    ([0, 1, 3, 27]).forEach(account => {
      expect(wallet.ethGetAccountPaths({ coin: 'Ethereum', accountIdx: account }))
        .toEqual([{
          hardenedPath: bip32ToAddressNList(`m/44'/60'/${account}'`),
          relPath: [0, 0],
          description: "KeepKey"
        }])
    })
  })

  it('locks the transport during calls', async () => {
    if (!wallet) return

    await wallet.wipe()
    await wallet.loadDevice({ mnemonic: "all all all all all all all all all all all all" })

    let addrs = []
    await new Promise(async (resolve) => {
      wallet.btcGetAddress({
        coin: "Bitcoin",
        addressNList: bip32ToAddressNList("m/44'/0'/0'/0/0"),
        showDisplay: true
      })
      .then((address) => { addrs.push(address) })

      wallet.btcGetAddress({
        coin: "Bitcoin",
        addressNList: bip32ToAddressNList("m/44'/0'/0'/0/1"),
        showDisplay: true
      })
      .then((address) => { addrs.push(address) })

      wallet.btcGetAddress({
        coin: "Bitcoin",
        addressNList: bip32ToAddressNList("m/44'/0'/0'/0/2"),
        showDisplay: true
      })
      .then((address) => { addrs.push(address); resolve() })
    })

    expect(addrs).toEqual([
      "1JAd7XCBzGudGpJQSDSfpmJhiygtLQWaGL",
      "1GWFxtwWmNVqotUPXLcKVL2mUKpshuJYo",
      "1Eni8JFS4yA2wJkicc3yx3QzCNzopLybCM"
    ])
  }, TIMEOUT)

  test('cancel works', async () => {
    if (!wallet) return

    autoButton = false

    expect(wallet.btcGetAddress({
      coin: "Bitcoin",
      addressNList: bip32ToAddressNList("m/44'/0'/0'/0/0"),
      showDisplay: true
    })).rejects.toThrow(ActionCancelled)

    await wallet.cancel()

    autoButton = true
  }, TIMEOUT)

  it('cancel is idempotent', async () => {
    if (!wallet) return

    await wallet.cancel()
    await wallet.cancel()

    expect(wallet.btcGetAddress({
      coin: "Bitcoin",
      addressNList: bip32ToAddressNList("m/44'/0'/0'/0/0"),
      showDisplay: true
    })).resolves.toEqual("1JAd7XCBzGudGpJQSDSfpmJhiygtLQWaGL")
  }, TIMEOUT)
}
