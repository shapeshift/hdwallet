import $ from 'jquery'
import * as debug from 'debug'
import {
  Keyring,
  supportsBTC,
  Events,
  base64toHEX
} from '@shapeshiftoss/hdwallet-core'

import { WebUSBKeepKeyAdapter } from '@shapeshiftoss/hdwallet-keepkey-webusb'
import { TCPKeepKeyAdapter } from '@shapeshiftoss/hdwallet-keepkey-tcp'
import { TrezorAdapter } from '@shapeshiftoss/hdwallet-trezor-connect'
import { WebUSBLedgerAdapter } from '@shapeshiftoss/hdwallet-ledger-webusb'
import { PortisAdapter } from '@shapeshiftoss/hdwallet-portis'

import {
  BTCInputScriptType,
} from '@shapeshiftoss/hdwallet-core/src/bitcoin'

const keyring = new Keyring()

const portisAppId = 'ff763d3d-9e34-45a1-81d1-caa39b9c64f9'

const keepkeyAdapter = WebUSBKeepKeyAdapter.useKeyring(keyring)
const kkemuAdapter = TCPKeepKeyAdapter.useKeyring(keyring)
const portisAdapter = PortisAdapter.useKeyring(keyring, { portisAppId })

const log = debug.default('hdwallet')

keyring.onAny((event: string[], ...values: any[]) => {
  const [[ , { from_wallet = false }]] = values
  let direction = from_wallet ? "<<<<<" : ">>>>>"
  log(direction + ' ' + event.join('.'), ...values)
})

const trezorAdapter = TrezorAdapter.useKeyring(keyring, {
  debug: false,
  manifest: {
    email: 'oss@shapeshiftoss.io',
    appUrl: 'https://shapeshift.com'
  }
})

const ledgerAdapter = WebUSBLedgerAdapter.useKeyring(keyring)

window['keyring'] = keyring

window.localStorage.debug = '*'
const loggers: {[deviceID: string]: debug.Debugger} = {}

let wallet
window['wallet'] = wallet

const $keepkey = $('#keepkey')
const $kkemu = $('#kkemu')
const $trezor = $('#trezor')
const $ledger = $('#ledger')
const $portis = $('#portis')
const $keyring = $('#keyring')

$keepkey.on('click', async (e) => {
  e.preventDefault()
  wallet = await keepkeyAdapter.pairDevice(undefined, /*tryDebugLink=*/true)
  listen(wallet.transport)
  window['wallet'] = wallet
  $('#keyring select').val(wallet.transport.getDeviceID())
})

$kkemu.on('click', async (e) => {
  e.preventDefault()
  wallet = await kkemuAdapter.pairDevice("http://localhost:5000")
  listen(wallet.transport)
  window['wallet'] = wallet
  $('#keyring select').val(wallet.transport.getDeviceID())
})

$trezor.on('click', async (e) => {
  e.preventDefault()
  wallet = await trezorAdapter.pairDevice()
  listen(wallet.transport)
  window['wallet'] = wallet
  $('#keyring select').val(await wallet.getDeviceID())
})

$ledger.on('click', async (e) => {
  e.preventDefault()
  wallet = await ledgerAdapter.pairDevice()
  window['wallet'] = wallet
  $('#keyring select').val(await wallet.getDeviceID())
})

$portis.on('click',  async (e) => {
  e.preventDefault()
  wallet = await portisAdapter.pairDevice()
  window['wallet'] = wallet

  let deviceId = 'nothing'
  try {
    deviceId  = await wallet.getDeviceID()
  } catch( e ) {
    console.error(e)
  }
  $('#keyring select').val(deviceId)
})

async function deviceConnected (deviceId) {
  let wallet = keyring.get(deviceId)
  if (!$keyring.find(`option[value="${deviceId}"]`).length) {
    $keyring.append(
      $("<option></option>")
        .attr("value", deviceId)
        .text(deviceId + ' - ' + await wallet.getVendor())
    )
  }
}

(async () => {
  try {
    await keepkeyAdapter.initialize(undefined, /*tryDebugLink=*/true, /*autoConnect=*/false)
  } catch (e) {
    console.error('Could not initialize KeepKeyAdapter', e)
  }

  try {
    await trezorAdapter.initialize()
  } catch (e) {
    console.error('Could not initialize TrezorAdapter', e)
  }

  try {
    await ledgerAdapter.initialize()
  } catch (e) {
    console.error('Could not initialize LedgerAdapter', e)
  }

  try {
    await portisAdapter.initialize()
  } catch (e) {
    console.error('Could not initialize PortisAdapter', e)
  }

  for (const [deviceID, wallet] of Object.entries(keyring.wallets)) {
    await deviceConnected(deviceID)
  }
  $keyring.change(async (e) => {
    if (wallet) {
      await wallet.disconnect()
    }
    let deviceID = $keyring.find(':selected').val() as string
    wallet = keyring.get(deviceID)
    if (wallet) {
      await wallet.transport.connect()
      await wallet.initialize()
    }
    window['wallet'] = wallet
  })
  wallet = keyring.get()
  window['wallet'] = wallet
  if (wallet) {
    let deviceID = wallet.getDeviceID()
    $keyring.val(deviceID).change()
  }

  keyring.on(['*', '*', Events.CONNECT], async (deviceId) => {
    await deviceConnected(deviceId)
  })

  keyring.on(['*', '*', Events.DISCONNECT], async (deviceId) => {
    $keyring.find(`option[value="${deviceId}"]`).remove()
  })
})()

window['handlePinDigit'] = function (digit) {
  let input = document.getElementById('#pinInput')
  if (digit === "") {
    input.value = input.value.slice(0, -1);
  } else {
    input.value += digit.toString();
  }
}

window['pinOpen'] = function () {
  document.getElementById('#pinModal').className = 'modale opened'
}

window['pinEntered'] = function () {
  let input = document.getElementById('#pinInput')
  wallet.sendPin(input.value);
  document.getElementById('#pinModal').className='modale';
}

window['passphraseOpen'] = function () {
  document.getElementById('#passphraseModal').className = 'modale opened'
}

window['passphraseEntered'] = function () {
  let input = document.getElementById('#passphraseInput')
  wallet.sendPassphrase(input.value);
  document.getElementById('#passphraseModal').className='modale';
}

function listen(transport) {
  if (!transport)
    return

  transport.on(Events.PIN_REQUEST, e => {
    window['pinOpen']()
  })

  transport.on(Events.PASSPHRASE_REQUEST, e => {
    window['passphraseOpen']()
  })
}

$('#verify').on('click', async (e) => {
  e.preventDefault()

  let $results = $('#verifyresults')

  if (!wallet) { $results.val("No wallet?"); return }

  if (!supportsBTC(wallet)) {
    $results.val('Wallet does not support Bitcoin')
    return
  }

  try {
    let address = $('#verifyaddress').val()
    let signature = base64toHEX($('#verifysignature').val()).substr(2)
    let message = $('#verifymessage').val()
    console.log({ address, signature, message })
    let res = await wallet.btcVerifyMessage({ address, coin: 'Bitcoin', signature, message })
    $results.val(res ? "✅" : "❌")
  } catch (error) {
    $results.val(error.message)
  }
})
