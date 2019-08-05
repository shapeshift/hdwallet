import $ from 'jquery'
import * as debug from 'debug'
import {
  Keyring,
  supportsETH,
  supportsBTC,
  supportsDebugLink,
  bip32ToAddressNList,
  Events
 } from '@shapeshift/hdwallet-core'

import { isKeepKey } from '@shapeshift/hdwallet-keepkey'

import { WebUSBKeepKeyAdapter } from '@shapeshift/hdwallet-keepkey-webusb'
import { TCPKeepKeyAdapter } from '@shapeshift/hdwallet-keepkey-tcp'
import { TrezorAdapter } from '@shapeshift/hdwallet-trezor-connect'
import { WebUSBLedgerAdapter } from '@shapeshift/hdwallet-ledger-webusb'
import {
  BTCInputScriptType,
  BTCOutputScriptType,
  BTCOutputAddressType, BitcoinTx, BitcoinInput, BitcoinOutput
} from '@shapeshift/hdwallet-core/src/bitcoin'

const keyring = new Keyring()

const keepkeyAdapter = WebUSBKeepKeyAdapter.useKeyring(keyring)
const kkemuAdapter = TCPKeepKeyAdapter.useKeyring(keyring)

const log = debug.default('hdwallet')

keyring.onAny((event: string[], ...values: any[]) => {
  const [[ , { from_wallet = false }]] = values
  let direction = from_wallet ? "<<<<<" : ">>>>>"
  log(direction + ' ' + event.join('.'), ...values)
})

const trezorAdapter = TrezorAdapter.useKeyring(keyring, {
  debug: false,
  manifest: {
    email: 'oss@shapeshift.io',
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

$ledger.on('click',  async (e) => {
  e.preventDefault()
  wallet = await ledgerAdapter.pairDevice()
  window['wallet'] = wallet
  $('#keyring select').val(await wallet.getDeviceID())
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

  for (const [deviceID, wallet] of Object.entries(keyring.wallets)) {
    await deviceConnected(deviceID)
  }
  $keyring.change(async (e) => {
    if (wallet) {
      await wallet.transport.disconnect()
    }
    let deviceID = $keyring.find(':selected').val() as string
    wallet = keyring.get(deviceID)
    if (wallet) {
      await wallet.transport.connect()
      if (isKeepKey(wallet)) {
        console.log("try connect debuglink")
        await wallet.transport.tryConnectDebugLink()
      }
      await wallet.initialize()
    }
    window['wallet'] = wallet
    console.log('wallet set to', deviceID, wallet)
  })
  wallet = keyring.get()
  window['wallet'] = wallet
  if (wallet) {
    let deviceID = wallet.transport.getDeviceID()
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

const $yes = $('#yes')
const $no = $('#no')
const $cancel = $('#cancel')

$yes.on('click', async (e) => {
  e.preventDefault()
  if (!wallet)
    return

  if (!supportsDebugLink(wallet))
    return

  await wallet.pressYes()
})

$no.on('click', async (e) => {
  e.preventDefault()
  if (!wallet)
    return

  if (!supportsDebugLink(wallet))
    return

  await wallet.pressNo()
})

$cancel.on('click', async (e) => {
  e.preventDefault()

  if (!wallet)
    return

  await wallet.cancel()
})

const $getVendor = $('#getVendor')
const $getModel = $('#getModel')
const $getLabel = $('#getLabel')
const $getXpubs = $('#getXpubs')
const $doPing = $('#doPing')
const $doWipe = $('#doWipe')
const $doLoadDevice = $('#doLoadDevice')
const $manageResults = $('#manageResults')

$getVendor.on('click', async (e) => {
  e.preventDefault()
  if (!wallet) { $manageResults.val("No wallet?"); return}
  let vendor = await wallet.getVendor()
  $manageResults.val(vendor)
})

$getModel.on('click', async (e) => {
  e.preventDefault()
  if (!wallet) { $manageResults.val("No wallet?"); return}
  let model = await wallet.getModel()
  $manageResults.val(model)
})

$getLabel.on('click', async (e) => {
  e.preventDefault()
  if (!wallet) { $manageResults.val("No wallet?"); return}
  let label = await wallet.getLabel()
  $manageResults.val(label)
})

$getXpubs.on('click', (e) => {
  e.preventDefault()
  if (!wallet) { $manageResults.val("No wallet?"); return}
  wallet.getPublicKeys([
    {
      addressNList: [ 0x80000000 + 44, 0x80000000 + 0, 0x80000000 + 0],
      curve: "secp256k1",
      showDisplay: true, // Not supported by TrezorConnect or Ledger, but KeepKey should do it
      coin: "Bitcoin"
    },
    {
      addressNList: [ 0x80000000 + 44, 0x80000000 + 0, 0x80000000 + 1],
      curve: "secp256k1",
      coin: "Bitcoin"
    },
    {
      addressNList: [ 0x80000000 + 49, 0x80000000 + 0, 0x80000000 + 0],
      curve: "secp256k1",
      coin: "Bitcoin",
      scriptType: BTCInputScriptType.SpendP2SHWitness
    },
    {
      addressNList: [0x80000000 + 44, 0x80000000 + 2, 0x80000000 + 0],
      curve: "secp256k1",
      coin: "Litecoin"
    }
  ]).then(result => { $manageResults.val(JSON.stringify(result)) })
})

$doPing.on('click', (e) => {
  e.preventDefault()
  if (!wallet) { $manageResults.val("No wallet?"); return}
  wallet.ping({ msg: "Hello World", button: true }).then(result => { $manageResults.val(result.msg) })
})

$doWipe.on('click', (e) => {
  e.preventDefault()
  if (!wallet) { $manageResults.val("No wallet?"); return}
  wallet.wipe()
})

$doLoadDevice.on('click', (e) => {
  e.preventDefault()
  if (!wallet) { $manageResults.val("No wallet?"); return}
  wallet.loadDevice({ mnemonic: /*trezor test seed:*/'alcohol woman abuse must during monitor noble actual mixed trade anger aisle' })
})

/*
      Ethereum
        * segwit: false
        * mutltisig: false
        * Bech32: false

*/
const $ethAddr = $('#ethAddr')
const $ethTx = $('#ethTx')
const $ethSign = $('#ethSign')
const $ethVerify = $('#ethVerify')
const $ethResults = $('#ethResults')

$ethAddr.on('click', async (e) => {
  e.preventDefault()
  if (!wallet) { $ethResults.val("No wallet?"); return}
  if (supportsETH(wallet)) {
    let { hardenedPath , relPath } = wallet.ethGetAccountPaths({ coin: "Ethereum", accountIdx: 0 })[0]
    let result = await wallet.ethGetAddress({
      addressNList: hardenedPath.concat(relPath),
      showDisplay: false
    })
    result = await wallet.ethGetAddress({
      addressNList: hardenedPath.concat(relPath),
      showDisplay: true,
      address: result
    })
    $ethResults.val(result)
  } else {
    let label = await wallet.getLabel()
    $ethResults.val(label + " does not support ETH")
  }
})

$ethTx.on('click', async (e) => {
  e.preventDefault()
  if (!wallet) { $ethResults.val("No wallet?"); return}
  if (supportsETH(wallet)) {
    let res = await wallet.ethSignTx({
      addressNList: bip32ToAddressNList("m/44'/60'/0'/0/0"),
      nonce: "0x01",
      gasPrice: "0x14",
      gasLimit: "0x14",
      value: '0x00',
      to: "0x41e5560054824ea6b0732e656e3ad64e20e94e45",
      chainId: 1,
      data: '0x' + 'a9059cbb000000000000000000000000' + '1d8ce9022f6284c3a5c317f8f34620107214e545' + '00000000000000000000000000000000000000000000000000000002540be400',
    })
    $ethResults.val(JSON.stringify(res))
  } else {
    let label = await wallet.getLabel()
    $ethResults.val(label + " does not support ETH")
  }
})

$ethSign.on('click', async (e) => {
  e.preventDefault()
  if (!wallet) { $ethResults.val("No wallet?"); return}
  if (supportsETH(wallet)) {
    let { hardenedPath: hard, relPath: rel } = wallet.ethGetAccountPaths({ coin: "Ethereum", accountIdx: 0 })[0]
    let result = await wallet.ethSignMessage({ addressNList: hard.concat(rel), message: "Hello World" })
    $ethResults.val(result.address + ', ' + result.signature)
  } else {
    let label = await wallet.getLabel()
    $ethResults.val(label + " does not support ETH")
  }
})

$ethVerify.on('click', async (e) => {
  e.preventDefault()
  if (!wallet) { $ethResults.val("No wallet?"); return}
  if (supportsETH(wallet)) {
    let result = await wallet.ethVerifyMessage({
      address: "0x2068dD92B6690255553141Dfcf00dF308281f763",
      message: "Hello World",
      signature: "61f1dda82e9c3800e960894396c9ce8164fd1526fccb136c71b88442405f7d09721725629915d10bc7cecfca2818fe76bc5816ed96a1b0cebee9b03b052980131b"
    })
    $ethResults.val(result ? '✅' : '❌')
  } else {
    let label = await wallet.getLabel()
    $ethResults.val(label + " does not support ETH")
  }
})

/*
      Bitcoin
        * segwit: true
        * mutltisig: true
        * Bech32

*/
const $btcAddr = $('#btcAddr')
const $btcTx = $('#btcTx')
const $btcSign = $('#btcSign')
const $btcVerify = $('#btcVerify')
const $btcResults = $('#btcResults')

$btcAddr.on('click', async (e) => {
  e.preventDefault()
  if (!wallet) { $btcResults.val("No wallet?"); return}
  if (supportsBTC(wallet)) {

    //coin 0 (mainnet bitcoin)
    //path 0
    let res = await wallet.btcGetAddress({
      addressNList: [0x80000000 + 44, 0x80000000 + 0, 0x80000000 + 0, 0, 0],
      coin: "Bitcoin",
      scriptType: BTCInputScriptType.SpendAddress,
      showDisplay: true
    })
    $btcResults.val(res)
  } else {
    let label = await wallet.getLabel()
    $btcResults.val(label + " does not support BTC")
  }
})

$btcTx.on('click', async (e) => {
  e.preventDefault()
  if (!wallet) { $btcResults.val("No wallet?"); return}
  if (supportsBTC(wallet)) {
    const txid = 'b3002cd9c033f4f3c2ee5a374673d7698b13c7f3525c1ae49a00d2e28e8678ea'
    const lookup = `https://api.ledgerwallet.com/blockchain/v2/btc/transactions/${txid}/hex`
    const response = await fetch(lookup)
    const data = await response.json()
    const hex = data[0].hex
    const txLookup = 'https://btc.coinquery.com/api/tx/'+txid
    const responseTx = await fetch(txLookup)
    const tx = await responseTx.json()

    let inputs = [{
      addressNList: [0x80000000 + 44, 0x80000000 + 0, 0x80000000 + 0, 0, 0],
      scriptType: BTCInputScriptType.SpendAddress,
      amount: 14657949219,
      vout: 0,
      txid: txid,
      tx,
      hex
    }]

    let outputs = [{
      address: '1MJ2tj2ThBE62zXbBYA5ZaN3fdve5CPAz1',
      addressType: BTCOutputAddressType.Spend,
      scriptType: BTCOutputScriptType.PayToAddress,
      amount: 390000 - 10000,
      isChange: false,
    }]
    let res = await wallet.btcSignTx({
      coin: 'Bitcoin',
      inputs: inputs,
      outputs: outputs,
      version: 1,
      locktime: 0
    })
    $btcResults.val(res.serializedTx)
  } else {
    let label = await wallet.getLabel()
    $btcResults.val(label + " does not support BTC")
  }
})

$btcSign.on('click', async (e) => {
  e.preventDefault()
  if (!wallet) { $btcResults.val("No wallet?"); return}
  if (supportsBTC(wallet)) {
    let res = await wallet.btcSignMessage({
      addressNList: bip32ToAddressNList("m/44'/0'/0'/0/0"),
      coin: 'Bitcoin',
      scriptType: BTCInputScriptType.SpendAddress,
      message: "Hello World"
    })
    $btcResults.val(res.address + ' ' + res.signature)
  } else {
    let label = await wallet.getLabel()
    $btcResults.val(label + " does not support BTC")
  }
})

$btcVerify.on('click', async (e) => {
  e.preventDefault()
  if (!wallet) { $btcResults.val("No wallet?"); return}
  if (supportsBTC(wallet)) {
    let res = await wallet.btcVerifyMessage({
      address: '1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM',
      coin: 'Bitcoin',
      signature: '20a037c911044cd6c851b6508317d8892067b0b62074b2cf1c0df9abd4aa053a3c243ffdc37f64d7af2c857128eafc81947c380995596615e5dcc313a15f512cdd',
      message: 'Hello World',
    })
    $btcResults.val(res ? '✅' : '❌')
  } else {
    let label = await wallet.getLabel()
    $btcResults.val(label + " does not support BTC")
  }
})

/*
      Litecoin
        * segwit: true
        * mutltisig: true

*/
const $ltcAddr = $('#ltcAddr')
const $ltcTx = $('#ltcTx')
const $ltcSign = $('#ltcSign')
const $ltcVerify = $('#ltcVerify')
const $ltcResults = $('#ltcResults')

const ltcBip44 = {
  scriptType: BTCInputScriptType.SpendAddress,
  addressNList: [0x80000000 + 44, 0x80000000 + 2, 0x80000000 + 0, 0, 0]
}

$ltcAddr.on('click', async (e) => {
  e.preventDefault()
  if (!wallet) { $ltcResults.val("No wallet?"); return}
  if (supportsBTC(wallet)) {
    let res = await wallet.btcGetAddress({
      addressNList: ltcBip44.addressNList,
      coin: 'Litecoin',
      scriptType: ltcBip44.scriptType,
      showDisplay: true
    })
    $ltcResults.val(res)
  } else {
    let label = await wallet.getLabel() // should be LYXTv5RdsPYKC4qGmb6x6SuKoFMxUdSjLQ
    $ltcResults.val(label + " does not support Litecoin")
  }
})

$ltcTx.on('click', async (e) => {
  e.preventDefault()
  if (!wallet) { $ltcResults.val("No wallet?"); return}
  if (supportsBTC(wallet)) {

    const txid = '1de79c706f34c81bbefad49a9ff8d12b6ca86b77605a1998505e4f8792a5892d'
    const lookup = `https://api.ledgerwallet.com/blockchain/v2/ltc/transactions/${txid}/hex`
    const response = await fetch(lookup)
    const data = await response.json()
    const hex = data[0].hex
    const txLookup = 'https://ltc.coinquery.com/api/tx/'+txid
    const responseTx = await fetch(txLookup)
    const tx = await responseTx.json()

    const inputs = [{
      addressNList: ltcBip44.addressNList,
      scriptType: BTCInputScriptType.SpendAddress,
      amount: 2160258,
      vout: 0,
      txid: txid,
      segwit: false,
      tx,
      hex
    }]

    const outputs = [{
      address: 'LLe4PciAJgMMJSAtQQ5nkC13t6SSMmERJ3',
      addressType: BTCOutputAddressType.Spend,
      scriptType: BTCOutputScriptType.PayToAddress,
      amount: 261614,
      isChange: false
    }]

    const res = await wallet.btcSignTx({
      coin: 'Litecoin',
      inputs,
      outputs,
      version: 1,
      locktime: 0
    })
    $ltcResults.val(res.serializedTx)
  } else {
    let label = await wallet.getLabel()
    $ltcResults.val(label + " does not support Litecoin")
  }
})

$ltcSign.on('click', async (e) => {
  e.preventDefault()
  if (!wallet) { $ltcResults.val("No wallet?"); return}
  if (supportsBTC(wallet)) {
    let res = await wallet.btcSignMessage({
      addressNList: ltcBip44.addressNList,
      coin: 'Litecoin',
      scriptType: BTCInputScriptType.SpendAddress,
      message: "Hello World"
    })
    $ltcResults.val(res.address + ' ' + res.signature)
    // Address: LYXTv5RdsPYKC4qGmb6x6SuKoFMxUdSjLQ
    // Signature: 1f835c7efaf953e059e7074afa954c5a8535be321f48e393e125e2a839d1721b495b935df1162c2b69f3e698167b75ab8bfd2c9c203f6070ff701ebca49653a056

  } else {
    let label = await wallet.getLabel()
    $ltcResults.val(label + " does not support Litecoin")
  }
})

/*
      Dogecoin
        * segwit: false
        * mutltisig: true

 */

const $dogeAddr = $('#dogeAddr')
const $dogeTx = $('#dogeTx')
const $dogeSign = $('#dogeSign')
const $dogeVerify = $('#dogeVerify')
const $dogeResults = $('#dogeResults')

const dogeBip44 = {
  scriptType: BTCInputScriptType.SpendAddress,
  addressNList: [0x80000000 + 44, 0x80000000 + 3, 0x80000000 + 0]
}
$dogeAddr.on('click', async (e) => {
  e.preventDefault()
  if (!wallet) { $dogeResults.val("No wallet?"); return}
  if (supportsBTC(wallet)) {
    let res = await wallet.btcGetAddress({
      addressNList: dogeBip44.addressNList.concat([0, 0]),
      coin: "Dogecoin",
      scriptType: dogeBip44.scriptType,
      showDisplay: true
    })
    $dogeResults.val(res)
  } else {
    let label = await wallet.getLabel() // should be DQTjL9vfXVbMfCGM49KWeYvvvNzRPaoiFp for alcohol abuse
    $dogeResults.val(label + " does not support DOGE")
  }
})

$dogeTx.on('click', async (e) => {
  e.preventDefault()
  if (!wallet) { $dogeResults.val("No wallet?"); return}
  if (supportsBTC(wallet)) {
    const txid = '4ab8c81585bf61ddcba03f4b2f4958b3800d68b02874f4955e258775cb3e7068'
    const lookup = `https://api.ledgerwallet.com/blockchain/v2/doge/transactions/${txid}/hex`
    const response = await fetch(lookup)
    const data = await response.json()
    const hex = data[0].hex
    const txLookup = 'https://doge.coinquery.com/api/tx/'+txid
    const responseTx = await fetch(txLookup)
    const tx = await responseTx.json()

    const inputs = [{
      addressNList: dogeBip44.addressNList.concat([0, 0]),
      scriptType: BTCInputScriptType.SpendAddress,
      amount: 14657949219,
      vout: 0,
      txid: txid,
      segwit: false,
      tx,
      hex
    }]

    const outputs = [{
      address: 'DMEHVGRsELY5zyYbfgta3pAhedKGeaDeJd',
      addressType: BTCOutputAddressType.Spend,
      scriptType: BTCOutputScriptType.PayToAddress,
      amount: 14557949219,
      isChange: false
    }]

    const res = await wallet.btcSignTx({
      coin: 'Dogecoin',
      inputs,
      outputs,
      version: 1,
      locktime: 0,

    })
    $dogeResults.val(res.serializedTx)
  } else {
    let label = await wallet.getLabel()
    $dogeResults.val(label + " does not support Litecoin")
  }
})

/*
      Bitcoin Cash
        * segwit: false
        * mutltisig: true

 */

const $bchAddr = $('#bchAddr')
const $bchTx = $('#bchTx')
const $bchSign = $('#bchSign')
const $bchVerify = $('#bchVerify')
const $bchResults = $('#bchResults')

const bchBip44 = {
  scriptType: BTCInputScriptType.SpendAddress,
  addressNList: [0x80000000 + 44, 0x80000000 + 145, 0x80000000 + 0]
}

$bchAddr.on('click', async (e) => {
  e.preventDefault()
  if (!wallet) { $bchResults.val("No wallet?"); return}
  if (supportsBTC(wallet)) {
    let res = await wallet.btcGetAddress({
      addressNList: bchBip44.addressNList.concat([0, 0]),
      coin: "BitcoinCash",
      scriptType: bchBip44.scriptType,
      showDisplay: true
    })
    $bchResults.val(res)
  } else {
    let label = await wallet.getLabel() // KK: bitcoincash:qzqxk2q6rhy3j9fnnc00m08g4n5dm827xv2dmtjzzp or Ledger: 1Ci1rvsLpZqvaMLSq7LiFj6mfnV4p3833E
    $bchResults.val(label + " does not support BCH")
  }
})

$bchTx.on('click', async (e) => {
  e.preventDefault()
  if (!wallet) { $bchResults.val("No wallet?"); return}
  if (supportsBTC(wallet)) {
    const txid = '35ec5b47eea3b45efb062c6fabad43987a79b855dc42630b34f8d26d4a646a2e'
    const lookup = `https://api.ledgerwallet.com/blockchain/v2/abc/transactions/${txid}/hex`
    const response = await fetch(lookup)
    const data = await response.json()
    const hex = data[0].hex

    const inputs = [{
      addressNList: bchBip44.addressNList.concat([0, 0]),
      scriptType: BTCInputScriptType.SpendAddress,
      amount: 1567200,
      vout: 0,
      txid: txid,
      segwit: false,
      hex
    }]

    const outputs = [{
      address: (await wallet.btcSupportsScriptType('BitcoinCash', BTCInputScriptType.CashAddr))
        ? 'bitcoincash:qq5mg2xtp9y5pvvgy7m4k2af5a7s5suulueyywgvnf'
        : '14oWXZFPhgP9DA3ggPzhHpUUaikDSjAuMC',
      addressType: BTCOutputAddressType.Spend,
      scriptType: BTCOutputScriptType.PayToAddress,
      amount: 1567200,
      isChange: false
    }]

    const res = await wallet.btcSignTx({
      coin: 'BitcoinCash',
      inputs,
      outputs,
      version: 1,
      locktime: 0,

    })
    $bchResults.val(res.serializedTx)
  } else {
    let label = await wallet.getLabel()
    $bchResults.val(label + " does not support Litecoin")
  }
})

/*
       Dash
        * segwit: false
        * mutltisig: true

 */

const $dashAddr = $('#dashAddr')
const $dashTx = $('#dashTx')
const $dashSign = $('#dashSign')
const $dashVerify = $('#dashVerify')
const $dashResults = $('#dashResults')

const dashBip44 = {
  scriptType: BTCInputScriptType.SpendAddress,
  addressNList: [0x80000000 + 44, 0x80000000 + 5, 0x80000000 + 0]
}

$dashAddr.on('click', async (e) => {
  e.preventDefault()
  if (!wallet) { $dashResults.val("No wallet?"); return}
  if (supportsBTC(wallet)) {
    let res = await wallet.btcGetAddress({
      addressNList: dashBip44.addressNList.concat([0, 0]),
      coin: "Dash",
      scriptType: dashBip44.scriptType,
      showDisplay: true
    })
    $dashResults.val(res)
  } else {
    let label = await wallet.getLabel()
    $dashResults.val(label + " does not support Dash")
  }
})

$dashTx.on('click', async (e) => {
  e.preventDefault()
  if (!wallet) { $dashResults.val("No wallet?"); return}
  if (supportsBTC(wallet)) {
    const txid = '0602c9ef3c74de624f1bc613a79764e5c51650b4cc0d076547061782baeeabdb'
    const lookup = `https://api.ledgerwallet.com/blockchain/v2/dash/transactions/${txid}/hex`
    const response = await fetch(lookup)
    const data = await response.json()
    const hex = data[0].hex
    const txLookup = 'https://dash.coinquery.com/api/tx/0602c9ef3c74de624f1bc613a79764e5c51650b4cc0d076547061782baeeabdb'
    const responseTx = await fetch(txLookup)
    const tx = await responseTx.json()

    const inputs = [{
      addressNList: dashBip44.addressNList.concat([0, 0]),
      scriptType: BTCInputScriptType.SpendAddress,
      amount: 20654195,
      vout: 0,
      txid: txid,
      segwit: false,
      tx,
      hex
    }]

    const outputs = [{
      address: 'XexybzTUtH9V9eY4UJN2aCcBT3utan5C8N',
      addressType: BTCOutputAddressType.Spend,
      scriptType: BTCOutputScriptType.PayToAddress,
      amount: 20664195,
      isChange: false
    }]

    const res = await wallet.btcSignTx({
      coin: 'Dash',
      inputs,
      outputs,
      version: 1,
      locktime: 0,

    })
    $dashResults.val(res.serializedTx)
  } else {
    let label = await wallet.getLabel()
    $dashResults.val(label + " does not support Dash")
  }
})

/*
      Bitcoin (segwit)
        * segwit: true
        * mutltisig: true
        * Bech32
 */

const $btcAddrSegWit = $('#btcAddrSegWit')
const $btcAddrSegWitNative = $('#btcAddrSegWitNative')
const $btcTxSegWit = $('#btcTxSegWit')
const $btcTxSegWitNative = $('#btcTxSegWitNative')
const $btcResultsSegWit = $('#btcResultsSegWit')


$btcAddrSegWit.on('click', async (e) => {
  e.preventDefault()
  if (!wallet) { $btcResultsSegWit.val("No wallet?"); return}
  if (supportsBTC(wallet)) {

    //coin 0 (mainnet bitcoin)
    //path 0
    let res = await wallet.btcGetAddress({
      addressNList: [0x80000000 + 49, 0x80000000 + 0, 0x80000000 + 0, 0, 0],
      coin: "Bitcoin",
      scriptType: BTCInputScriptType.SpendP2SHWitness,
      showDisplay: true
    })

    $btcResultsSegWit.val(res)
  } else {
    let label = await wallet.getLabel()
    $btcResultsSegWit.val(label + " does not support BTC")
  }
})

$btcAddrSegWitNative.on('click', async (e) => {
  e.preventDefault()
  if (!wallet) { $btcResultsSegWit.val("No wallet?"); return}
  if (supportsBTC(wallet)) {

    //coin 0 (mainnet bitcoin)
    //path 0
    let res = await wallet.btcGetAddress({
      addressNList:[0x80000000 + 84, 0x80000000 + 0, 0x80000000 + 0, 0, 0],
      coin: "Bitcoin",
      scriptType: BTCInputScriptType.SpendWitness,
      showDisplay: true
    })
    $btcResultsSegWit.val(res)
  } else {
    let label = await wallet.getLabel()
    $btcResultsSegWit.val(label + " does not support BTC")
  }
})

$btcTxSegWit.on('click', async (e) => {
  e.preventDefault()
  if (!wallet) { $btcResultsSegWit.val("No wallet?"); return}
  if (supportsBTC(wallet)) {

    const txid = '609410a9eac51cdce2b9c1911c7b8705bc566e164bca07ae25f2dee87b5b6a91'
    const lookup = `https://api.ledgerwallet.com/blockchain/v2/btc/transactions/${txid}/hex`
    const response = await fetch(lookup)
    const data = await response.json()
    const hex = data[0].hex
    const txLookup = 'https://btc.coinquery.com/api/tx/'+txid
    const responseTx = await fetch(txLookup)
    const tx = await responseTx.json()

    let inputs = [
      {
        addressNList: [0x80000000 + 49, 0x80000000 + 0, 0x80000000 + 0, 0, 0],
        amount: 100000,
        vout: 0,
        txid: txid,
        scriptType: BTCInputScriptType.SpendP2SHWitness,
        tx,
        hex
      }
    ]

    let outputs = [{
      address: '3Eq3agTHEhMCC8sZHnJJcCcZFB7BBSJKWr',
      addressType: BTCOutputAddressType.Spend,
      scriptType: BTCOutputScriptType.PayToAddress,
      amount: 89869,
    }]
    let res = await wallet.btcSignTx({
      coin: 'Bitcoin',
      inputs: inputs,
      outputs: outputs,
      version: 1,
      locktime: 0
    })
    $btcResultsSegWit.val(res.serializedTx)
  } else {
    let label = await wallet.getLabel()
    $btcResultsSegWit.val(label + " does not support BTC")
  }
})


$btcTxSegWitNative.on('click', async (e) => {
  e.preventDefault()
  if (!wallet) { $btcResultsSegWit.val("No wallet?"); return}
  if (supportsBTC(wallet)) {

    const txid = '2a873672cd30bfe60f05f16db4cadec26677af0971d8fd250aa0ea1bdd8e5942'
    const lookup = `https://api.ledgerwallet.com/blockchain/v2/btc/transactions/${txid}/hex`
    const response = await fetch(lookup)
    const data = await response.json()
    const hex = data[0].hex
    const txLookup = 'https://btc.coinquery.com/api/tx/'+txid
    const responseTx = await fetch(txLookup)
    const tx = await responseTx.json()

    let inputs = [
      {
        addressNList: [0x80000000 + 84, 0x80000000 + 0, 0x80000000 + 0],
        amount: 100000,
        vout: 0,
        txid: txid,
        scriptType: BTCInputScriptType.SpendWitness,
        tx,
        hex
      }
    ]

    let outputs = [{
      address: 'bc1qc5dgazasye0yrzdavnw6wau5up8td8gdqh7t6m',
      addressType: BTCOutputAddressType.Spend,
      scriptType: BTCOutputScriptType.PayToAddress,
      amount: 89869,
    }]
    let res = await wallet.btcSignTx({
      coin: 'Bitcoin',
      inputs: inputs,
      outputs: outputs,
      version: 1,
      locktime: 0
    })
    $btcResultsSegWit.val(res.serializedTx)
  } else {
    let label = await wallet.getLabel()
    $btcResultsSegWit.val(label + " does not support BTC")
  }
})
