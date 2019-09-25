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
import { KeepKeyHDWallet, KeepKeyHDWalletInfo, isKeepKey, info } from '@shapeshiftoss/hdwallet-keepkey'
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
  return info()
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
      let paths = wallet.ethGetAccountPaths({ coin: 'Ethereum', accountIdx: account })
      expect(paths)
        .toEqual([{
          addressNList: bip32ToAddressNList(`m/44'/60'/${account}'/0/0`),
          hardenedPath: bip32ToAddressNList(`m/44'/60'/${account}'`),
          relPath: [0, 0],
          description: "KeepKey"
        }])
      paths.forEach(path => {
        expect(wallet.describePath({
          coin: 'Ethereum',
          path: path.addressNList
        }).isKnown).toBeTruthy()
      })
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

  it('uses correct bip44 paths', () => {
    if (!wallet) return

    let paths = wallet.btcGetAccountPaths({
      coin: 'Litecoin',
      accountIdx: 3,
    })

    expect(paths).toEqual([{
      "addressNList": [
        2147483692,
        2147483650,
        2147483651,
      ],
      "scriptType": BTCInputScriptType.SpendAddress,
      'coin': 'Litecoin',
    }, {
      "addressNList": [
        2147483697,
        2147483650,
        2147483651,
      ],
      "scriptType": BTCInputScriptType.SpendP2SHWitness,
      'coin': 'Litecoin',
    }, {
      "addressNList": [
        2147483732,
        2147483650,
        2147483651,
      ],
      "scriptType": BTCInputScriptType.SpendWitness,
      'coin': 'Litecoin',
    }])
  })

  it('supports btcNextAccountPath', () => {
    if (!wallet) return

    let paths = wallet.btcGetAccountPaths({
      coin: 'Litecoin',
      accountIdx: 3,
    })

    expect(paths
      .map(path => wallet.btcNextAccountPath(path))
      .map(path => wallet.describePath({
        ...path,
        path: path.addressNList
      }))
    ).toEqual([{
      "accountIdx": 4,
      "coin": "Litecoin",
      "isKnown": true,
      "scriptType": "p2pkh",
      "verbose": "Litecoin Account #4 (Legacy)",
      "wholeAccount": true,
    }, {
      "accountIdx": 4,
      "coin": "Litecoin",
      "isKnown": true,
      "scriptType": "p2sh-p2wpkh",
      "verbose": "Litecoin Account #4",
      "wholeAccount": true,
    }, {
      "accountIdx": 4,
      "coin": "Litecoin",
      "isKnown": true,
      "scriptType": "p2wpkh",
      "verbose": "Litecoin Account #4 (Segwit Native)",
      "wholeAccount": true,
    }])
  })

  it('can describe paths', () => {
    expect(wallet.info.describePath({
      path: bip32ToAddressNList("m/44'/0'/0'/0/0"),
      coin: 'Bitcoin',
      scriptType: BTCInputScriptType.SpendAddress
    })).toEqual({
      verbose: "Bitcoin Account #0, Address #0",
      coin: 'Bitcoin',
      isKnown: true,
      scriptType: BTCInputScriptType.SpendAddress,
      accountIdx: 0,
      addressIdx: 0,
      wholeAccount: false,
      isChange: false,
    })

    expect(wallet.info.describePath({
      path: bip32ToAddressNList("m/44'/0'/7'/1/5"),
      coin: 'Bitcoin',
      scriptType: BTCInputScriptType.SpendAddress
    })).toEqual({
      verbose: "Bitcoin Account #7, Change Address #5",
      coin: 'Bitcoin',
      isKnown: true,
      scriptType: BTCInputScriptType.SpendAddress,
      accountIdx: 7,
      addressIdx: 5,
      wholeAccount: false,
      isChange: true,
    })

    expect(wallet.info.describePath({
      path: bip32ToAddressNList("m/44'/0'/7'/1/5"),
      coin: 'BitcoinCash',
      scriptType: BTCInputScriptType.SpendAddress
    })).toEqual({
      verbose: "m/44'/0'/7'/1/5",
      coin: 'BitcoinCash',
      isKnown: false,
      scriptType: BTCInputScriptType.SpendAddress
    })

    expect(wallet.info.describePath({
      path: bip32ToAddressNList("m/44'/60'/0'/0/0"),
      coin: 'Ethereum'
    })).toEqual({
      verbose: "Ethereum Account #0",
      coin: 'Ethereum',
      isKnown: true,
      accountIdx: 0,
      wholeAccount: true
    })

    expect(wallet.info.describePath({
      path: bip32ToAddressNList("m/44'/60'/3'/0/0"),
      coin: 'Ethereum'
    })).toEqual({
      verbose: "Ethereum Account #3",
      coin: 'Ethereum',
      isKnown: true,
      accountIdx: 3,
      wholeAccount: true
    })

    expect(wallet.info.describePath({
      path: bip32ToAddressNList("m/44'/60'/0'/0/3"),
      coin: 'Ethereum'
    })).toEqual({
      verbose: "m/44'/60'/0'/0/3",
      coin: 'Ethereum',
      isKnown: false,
    })
  })
}
