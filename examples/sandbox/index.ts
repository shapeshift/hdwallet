import $ from "jquery";
import * as debug from "debug";
import {
  Keyring,
  supportsETH,
  supportsBTC,
  supportsCosmos,
  supportsRipple,
  supportsBinance,
  supportsEos,
  supportsDebugLink,
  bip32ToAddressNList,
  Events,
  toHexString,
} from "@shapeshiftoss/hdwallet-core";

import { isKeepKey } from "@shapeshiftoss/hdwallet-keepkey";
import { isPortis } from "@shapeshiftoss/hdwallet-portis";

import { WebUSBKeepKeyAdapter } from "@shapeshiftoss/hdwallet-keepkey-webusb";
import { TCPKeepKeyAdapter } from "@shapeshiftoss/hdwallet-keepkey-tcp";
import { TrezorAdapter } from "@shapeshiftoss/hdwallet-trezor-connect";
import { WebUSBLedgerAdapter } from "@shapeshiftoss/hdwallet-ledger-webusb";
import { PortisAdapter } from "@shapeshiftoss/hdwallet-portis";
import { NativeAdapter } from "@shapeshiftoss/hdwallet-native";

import {
  BTCInputScriptType,
  BTCOutputScriptType,
  BTCOutputAddressType,
} from "@shapeshiftoss/hdwallet-core/src/bitcoin";

import * as btcBech32TxJson from "./json/btcBech32Tx.json";
import * as btcTxJson from "./json/btcTx.json";
import * as btcSegWitTxJson from "./json/btcSegWitTx.json";
import * as dashTxJson from "./json/dashTx.json";
import * as dogeTxJson from "./json/dogeTx.json";
import * as ltcTxJson from "./json/ltcTx.json";
import * as rippleTxJson from "./json/rippleTx.json";

const keyring = new Keyring();

const portisAppId = "ff763d3d-9e34-45a1-81d1-caa39b9c64f9";
const mnemonic =
  "close exit cigar radar census olympic history obvious crazy code cream try";

const keepkeyAdapter = WebUSBKeepKeyAdapter.useKeyring(keyring);
const kkemuAdapter = TCPKeepKeyAdapter.useKeyring(keyring);
const portisAdapter = PortisAdapter.useKeyring(keyring, { portisAppId });
const nativeAdapter = NativeAdapter.useKeyring(keyring, {
  mnemonic,
  deviceId: "native-wallet-test",
});

const log = debug.default("hdwallet");

keyring.onAny((name: string[], ...values: any[]) => {
  const [[deviceId, event]] = values;
  const { from_wallet = false, message_type } = event;
  let direction = from_wallet ? "🔑" : "💻";
  debug.default(deviceId)(`${direction} ${message_type}`, event);
});

const trezorAdapter = TrezorAdapter.useKeyring(keyring, {
  debug: false,
  manifest: {
    email: "oss@shapeshiftoss.io",
    appUrl: "https://shapeshift.com",
  },
});

const ledgerAdapter = WebUSBLedgerAdapter.useKeyring(keyring);

window["keyring"] = keyring;

window.localStorage.debug = "*";
const loggers: { [deviceID: string]: debug.Debugger } = {};

let wallet;
window["wallet"] = wallet;

const $keepkey = $("#keepkey");
const $kkemu = $("#kkemu");
const $trezor = $("#trezor");
const $ledger = $("#ledger");
const $portis = $("#portis");
const $native = $("#native");
const $keyring = $("#keyring");

$keepkey.on("click", async (e) => {
  e.preventDefault();
  wallet = await keepkeyAdapter.pairDevice(undefined, /*tryDebugLink=*/ true);
  listen(wallet.transport);
  window["wallet"] = wallet;
  $("#keyring select").val(wallet.transport.getDeviceID());
});

$kkemu.on("click", async (e) => {
  e.preventDefault();
  wallet = await kkemuAdapter.pairDevice("http://localhost:5000");
  listen(wallet.transport);
  window["wallet"] = wallet;
  $("#keyring select").val(wallet.transport.getDeviceID());
});

$trezor.on("click", async (e) => {
  e.preventDefault();
  wallet = await trezorAdapter.pairDevice();
  listen(wallet.transport);
  window["wallet"] = wallet;
  $("#keyring select").val(await wallet.getDeviceID());
});

$ledger.on("click", async (e) => {
  e.preventDefault();
  wallet = await ledgerAdapter.pairDevice();
  window["wallet"] = wallet;
  $("#keyring select").val(await wallet.getDeviceID());
});

$portis.on("click", async (e) => {
  e.preventDefault();
  wallet = await portisAdapter.pairDevice();
  window["wallet"] = wallet;

  let deviceId = "nothing";
  try {
    deviceId = await wallet.getDeviceID();
  } catch (e) {
    console.error(e);
  }
  $("#keyring select").val(deviceId);
});

$native.on("click", async (e) => {
  e.preventDefault();
  wallet = await nativeAdapter.pairDevice();
  window["wallet"] = wallet;
  $("#keyring select").val(await wallet.getDeviceID());
});

async function deviceConnected(deviceId) {
  let wallet = keyring.get(deviceId);
  if (!$keyring.find(`option[value="${deviceId}"]`).length) {
    $keyring.append(
      $("<option></option>")
        .attr("value", deviceId)
        .text(deviceId + " - " + (await wallet.getVendor()))
    );
  }
}

(async () => {
  try {
    await keepkeyAdapter.initialize(
      undefined,
      /*tryDebugLink=*/ true,
      /*autoConnect=*/ false
    );
  } catch (e) {
    console.error("Could not initialize KeepKeyAdapter", e);
  }

  try {
    await trezorAdapter.initialize();
  } catch (e) {
    console.error("Could not initialize TrezorAdapter", e);
  }

  try {
    await ledgerAdapter.initialize();
  } catch (e) {
    console.error("Could not initialize LedgerAdapter", e);
  }

  try {
    await portisAdapter.initialize();
  } catch (e) {
    console.error("Could not initialize PortisAdapter", e);
  }

  try {
    await nativeAdapter.initialize();
  } catch (e) {
    console.error("Could not initialize NativeAdapter", e);
  }

  for (const [deviceID, wallet] of Object.entries(keyring.wallets)) {
    await deviceConnected(deviceID);
  }
  $keyring.change(async (e) => {
    if (wallet) {
      await wallet.disconnect();
    }
    let deviceID = $keyring.find(":selected").val() as string;
    wallet = keyring.get(deviceID);
    if (wallet) {
      if (wallet.transport) {
        await wallet.transport.connect();
        if (isKeepKey(wallet)) {
          console.log("try connect debuglink");
          await wallet.transport.tryConnectDebugLink();
        }
      }
      await wallet.initialize();
    }
    window["wallet"] = wallet;
  });
  wallet = keyring.get();
  window["wallet"] = wallet;
  if (wallet) {
    let deviceID = wallet.getDeviceID();
    $keyring.val(deviceID).change();
  }

  keyring.on(["*", "*", Events.CONNECT], async (deviceId) => {
    await deviceConnected(deviceId);
  });

  keyring.on(["*", "*", Events.DISCONNECT], async (deviceId) => {
    $keyring.find(`option[value="${deviceId}"]`).remove();
  });
})();

window["handlePinDigit"] = function (digit) {
  let input = document.getElementById("#pinInput");
  if (digit === "") {
    input.value = input.value.slice(0, -1);
  } else {
    input.value += digit.toString();
  }
};

window["pinOpen"] = function () {
  document.getElementById("#pinModal").className = "modale opened";
};

window["pinEntered"] = function () {
  let input = document.getElementById("#pinInput");
  wallet.sendPin(input.value);
  document.getElementById("#pinModal").className = "modale";
};

window["passphraseOpen"] = function () {
  document.getElementById("#passphraseModal").className = "modale opened";
};

window["passphraseEntered"] = function () {
  let input = document.getElementById("#passphraseInput");
  wallet.sendPassphrase(input.value);
  document.getElementById("#passphraseModal").className = "modale";
};

function listen(transport) {
  if (!transport) return;

  transport.on(Events.PIN_REQUEST, (e) => {
    window["pinOpen"]();
  });

  transport.on(Events.PASSPHRASE_REQUEST, (e) => {
    window["passphraseOpen"]();
  });
}

const $yes = $("#yes");
const $no = $("#no");
const $cancel = $("#cancel");

$yes.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) return;

  if (!supportsDebugLink(wallet)) return;

  await wallet.pressYes();
});

$no.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) return;

  if (!supportsDebugLink(wallet)) return;

  await wallet.pressNo();
});

$cancel.on("click", async (e) => {
  e.preventDefault();

  if (!wallet) return;

  await wallet.cancel();
});

const $getVendor = $("#getVendor");
const $getModel = $("#getModel");
const $getDeviceID = $("#getDeviceID");
const $getFirmware = $("#getFirmware");
const $getLabel = $("#getLabel");
const $getXpubs = $("#getXpubs");
const $doPing = $("#doPing");
const $doWipe = $("#doWipe");
const $doLoadDevice = $("#doLoadDevice");
const $manageResults = $("#manageResults");

$getVendor.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $manageResults.val("No wallet?");
    return;
  }
  let vendor = await wallet.getVendor();
  $manageResults.val(vendor);
});

$getModel.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $manageResults.val("No wallet?");
    return;
  }
  let model = await wallet.getModel();
  $manageResults.val(model);
});

$getDeviceID.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $manageResults.val("No wallet?");
    return;
  }
  let deviceID = await wallet.getDeviceID();
  $manageResults.val(deviceID);
});

$getFirmware.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $manageResults.val("No wallet?");
    return;
  }
  let firmware = await wallet.getFirmwareVersion();
  $manageResults.val(firmware);
});

$getLabel.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $manageResults.val("No wallet?");
    return;
  }
  let label = await wallet.getLabel();
  $manageResults.val(label);
});

$getXpubs.on("click", async (e) => {
  e.preventDefault();

  if (!wallet) {
    $manageResults.val("No wallet?");
    return;
  }

  // Get Ethereum path
  const { hardenedPath } = wallet.ethGetAccountPaths({
    coin: "Ethereum",
    accountIdx: 0,
  })[0];

  const result = await wallet.getPublicKeys([
    {
      addressNList: [0x80000000 + 44, 0x80000000 + 0, 0x80000000 + 0],
      curve: "secp256k1",
      showDisplay: true, // Not supported by TrezorConnect or Ledger, but KeepKey should do it
      coin: "Bitcoin",
    },
    {
      addressNList: [0x80000000 + 44, 0x80000000 + 0, 0x80000000 + 1],
      curve: "secp256k1",
      showDisplay: true, // Not supported by TrezorConnect or Ledger, but KeepKey should do it
      coin: "Bitcoin",
    },
    {
      addressNList: [0x80000000 + 49, 0x80000000 + 0, 0x80000000 + 0],
      curve: "secp256k1",
      showDisplay: true, // Not supported by TrezorConnect or Ledger, but KeepKey should do it
      coin: "Bitcoin",
      scriptType: BTCInputScriptType.SpendP2SHWitness,
    },
    {
      addressNList: [0x80000000 + 44, 0x80000000 + 2, 0x80000000 + 0],
      curve: "secp256k1",
      showDisplay: true, // Not supported by TrezorConnect or Ledger, but KeepKey should do it
      coin: "Litecoin",
    },
    {
      addressNList: hardenedPath,
      curve: "secp256k1",
      showDisplay: true, // Not supported by TrezorConnect or Ledger, but KeepKey should do it
      coin: isPortis(wallet) ? "Bitcoin" : "Ethereum",
    },
  ]);

  $manageResults.val(JSON.stringify(result));
});

$doPing.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $manageResults.val("No wallet?");
    return;
  }
  const result = await wallet.ping({ msg: "Hello World", button: true });
  $manageResults.val(result.msg);
});

$doWipe.on("click", (e) => {
  e.preventDefault();
  if (!wallet) {
    $manageResults.val("No wallet?");
    return;
  }
  wallet.wipe();
});

$doLoadDevice.on("click", (e) => {
  e.preventDefault();
  if (!wallet) {
    $manageResults.val("No wallet?");
    return;
  }
  wallet.loadDevice({
    mnemonic:
      /*trezor test seed:*/ "alcohol woman abuse must during monitor noble actual mixed trade anger aisle",
  });
});

const $openApp = $("#openApp");
const $ledgerApp = $("#ledgerApp");
const $validateApp = $("#validateApp");
const $appSymbol = $("#appSymbol");
const $getAppInfo = $("#getAppInfo");
const $appInfo = $("#appInfo");

$ledgerApp.attr("placeholder", "App name i.e. Bitcoin Cash");
$appSymbol.attr("placeholder", "App symbol i.e. BCH");

$openApp.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ledgerApp.val("No wallet?");
    return;
  }
  const appName = $("#ledgerApp").val();
  if (!appName) {
    $ledgerApp.val("Please enter app name here");
    return;
  }
  let result;
  try {
    await wallet.openApp(appName);
    result = "Check device for prompt";
  } catch (err) {
    console.error(err);
    result = err.message;
  }
  $ledgerApp.val(result);
});

$validateApp.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $appSymbol.val("No wallet?");
    return;
  }
  const appSymbol = $("#appSymbol").val();
  if (!appSymbol) {
    $appSymbol.val("Please enter app symbol here");
    return;
  }
  let result;
  try {
    await wallet.validateCurrentApp(appSymbol);
    result = "Correct app open";
  } catch (err) {
    console.error(err);
    result = err.message;
  }
  $appSymbol.val(result);
});

$getAppInfo.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $appInfo.val("No wallet?");
    return;
  }
  let result;
  try {
    const res = await wallet.transport.call(null, "getAppAndVersion");
    result = res.payload.name;
  } catch (err) {
    console.error(err);
    result = err.message;
  }
  $appInfo.val(result);
});

/*
 * Binance
 */
const $binanceAddr = $("#binanceAddr");
const $binanceTx = $("#binanceTx");
const $binanceResults = $("#binanceResults");

$binanceAddr.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $binanceResults.val("No wallet?");
    return;
  }
  if (supportsBinance(wallet)) {
    let { addressNList } = wallet.binanceGetAccountPaths({ accountIdx: 0 })[0];
    let result = await wallet.binanceGetAddress({
      addressNList,
      showDisplay: false,
    });
    result = await wallet.binanceGetAddress({
      addressNList,
      showDisplay: true,
      address: result,
    });
    $binanceResults.val(result);
  } else {
    let label = await wallet.getLabel();
    $binanceResults.val(label + " does not support Binance");
  }
});

$binanceTx.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $binanceResults.val("No wallet?");
    return;
  }
  if (supportsBinance(wallet)) {
    let unsigned = {
      account_number: "34",
      chain_id: "Binance-Chain-Nile",
      data: "null",
      memo: "test",
      msgs: [
        {
          inputs: [
            {
              address: "tbnb1hgm0p7khfk85zpz5v0j8wnej3a90w709zzlffd",
              coins: [{ amount: 1000000000, denom: "BNB" }],
            },
          ],
          outputs: [
            {
              address: "tbnb1ss57e8sa7xnwq030k2ctr775uac9gjzglqhvpy",
              coins: [{ amount: 1000000000, denom: "BNB" }],
            },
          ],
        },
      ],
      sequence: "31",
      source: "1",
    };

    let res = await wallet.binanceSignTx({
      addressNList: bip32ToAddressNList(`m/44'/714'/0'/0/0`),
      chain_id: "Binance-Chain-Nile",
      account_number: "24250",
      sequence: "31",
      tx: unsigned,
    });
    $binanceResults.val(JSON.stringify(res));
  } else {
    let label = await wallet.getLabel();
    $binanceResults.val(label + " does not support Cosmos");
  }
});

/*
 * Ripple
 */
const $rippleAddr = $("#rippleAddr");
const $rippleTx = $("#rippleTx");
const $rippleResults = $("#rippleResults");

$rippleAddr.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $rippleResults.val("No wallet?");
    return;
  }
  if (supportsRipple(wallet)) {
    let { addressNList } = wallet.rippleGetAccountPaths({ accountIdx: 0 })[0];
    let result = await wallet.rippleGetAddress({
      addressNList,
      showDisplay: true,
    });
    $rippleResults.val(result);
  } else {
    let label = await wallet.getLabel();
    $rippleResults.val(label + " does not support Ripple");
  }
});

$rippleTx.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ethResults.val("No wallet?");
    return;
  }
  if (supportsRipple(wallet)) {
    let res = await wallet.rippleSignTx({
      addressNList: bip32ToAddressNList(`m/44'/144'/0'/0/0`),
      tx: rippleTxJson,
      flags: undefined,
      sequence: "3",
      lastLedgerSequence: "0",
      payment: {
        amount: "47000",
        destination: "rEpwmtmvx8gkMhX5NLdU3vutQt7dor4MZm",
        destinationTag: "1234567890",
      },
    });
    $rippleResults.val(JSON.stringify(res));
  } else {
    let label = await wallet.getLabel();
    $rippleResults.val(label + " does not support Ripple");
  }
});

/*
 * Eos
 */
const $eosAddr = $("#eosAddr");
const $eosTx = $("#eosTx");
const $eosResults = $("#eosResults");

$eosAddr.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ethResults.val("No wallet?");
    return;
  }
  if (supportsEos(wallet)) {
    let { addressNList } = wallet.eosGetAccountPaths({ accountIdx: 0 })[0];
    let result = await wallet.eosGetPublicKey({
      addressNList,
      showDisplay: false,
      kind: 0,
    });
    result = await wallet.eosGetPublicKey({
      addressNList,
      showDisplay: true,
      kind: 0,
      address: result,
    });
    $eosResults.val(result);
  } else {
    let label = await wallet.getLabel();
    $eosResults.val(label + " does not support Eos");
  }
});

$eosTx.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ethResults.val("No wallet?");
    return;
  }
  if (supportsEos(wallet)) {
    let unsigned_main = {
      expiration: "2020-04-30T22:00:00.000",
      ref_block_num: 54661,
      ref_block_prefix: 2118672142,
      max_net_usage_words: 0,
      max_cpu_usage_ms: 0,
      delay_sec: 0,
      context_free_actions: [],
      actions: [
        {
          account: "eosio.token",
          name: "transfer",
          authorization: [
            {
              actor: "xhackmebrosx",
              permission: "active",
            },
          ],
          data: {
            from: "xhackmebrosx",
            to: "xhighlanderx",
            quantity: "0.0001 EOS",
            memo: "testmemo",
          },
        },
      ],
    };

    let chainid_main =
      "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906";
    let res = await wallet.eosSignTx({
      addressNList: bip32ToAddressNList("m/44'/194'/0'/0/0"),
      chain_id: chainid_main,
      tx: unsigned_main,
    });

    console.log(res);
    console.log("sigV = %d", res.signatureV);
    console.log("sigR = %s", toHexString(res.signatureR));
    console.log("sigS = %s", toHexString(res.signatureS));
    console.log("hash = %s", toHexString(res.hash));
    console.log("EosFormatSig = %s", res.eosFormSig);
    console.log(
      "EosFormReSig = SIG_K1_Jxa7NRL1hj4Q9wqufaSZa7oAXQQnRxSuAeFSwx6EzHnzPVeB5y6qQge16WCYa3Xod1mDWZv3MnEEPFeK3bEf3iN6es1iVy"
    );

    $eosResults.val(res.eosFormSig);
  } else {
    let label = await wallet.getLabel();
    $eosResults.val(label + " does not support Eos");
  }
});

/*
 * Cosmos
 */
const $cosmosAddr = $("#cosmosAddr");
const $cosmosTx = $("#cosmosTx");
const $cosmosResults = $("#cosmosResults");

$cosmosAddr.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ethResults.val("No wallet?");
    return;
  }
  if (supportsCosmos(wallet)) {
    let { addressNList } = wallet.cosmosGetAccountPaths({ accountIdx: 0 })[0];
    let result = await wallet.cosmosGetAddress({
      addressNList,
      showDisplay: false,
    });
    result = await wallet.cosmosGetAddress({
      addressNList,
      showDisplay: true,
      address: result,
    });
    $cosmosResults.val(result);
  } else {
    let label = await wallet.getLabel();
    $cosmosResults.val(label + " does not support Cosmos");
  }
});

$cosmosTx.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ethResults.val("No wallet?");
    return;
  }
  if (supportsCosmos(wallet)) {
    let unsigned = {
      type: "auth/StdTx",
      value: {
        fee: {
          amount: [
            {
              amount: "1000",
              denom: "uatom",
            },
          ],
          gas: "28000",
        },
        memo: "KeepKey",
        msg: [
          {
            type: "cosmos-sdk/MsgSend",
            value: {
              amount: [
                {
                  amount: "47000",
                  denom: "uatom",
                },
              ],
              from_address: "cosmos1934nqs0ke73lm5ej8hs9uuawkl3ztesg9jp5c5",
              to_address: "cosmos14um3sf75lc0kpvgrpj9hspqtv0375epn05cpfa",
            },
          },
        ],
        signatures: null,
      },
    };

    let res = await wallet.cosmosSignTx({
      addressNList: bip32ToAddressNList(`m/44'/118'/0'/0/0`),
      chain_id: "cosmoshub-2",
      account_number: "24250",
      sequence: "3",
      tx: unsigned,
    });
    $cosmosResults.val(JSON.stringify(res));
  } else {
    let label = await wallet.getLabel();
    $cosmosResults.val(label + " does not support Cosmos");
  }
});

/*
      Ethereum
        * segwit: false
        * mutltisig: false
        * Bech32: false

*/
const $ethAddr = $("#ethAddr");
const $ethTx = $("#ethTx");
const $ethSign = $("#ethSign");
const $ethVerify = $("#ethVerify");
const $ethResults = $("#ethResults");

$ethAddr.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ethResults.val("No wallet?");
    return;
  }

  if (supportsETH(wallet)) {
    let { hardenedPath, relPath } = wallet.ethGetAccountPaths({
      coin: "Ethereum",
      accountIdx: 0,
    })[0];
    let result = await wallet.ethGetAddress({
      addressNList: hardenedPath.concat(relPath),
      showDisplay: false,
    });
    result = await wallet.ethGetAddress({
      addressNList: hardenedPath.concat(relPath),
      showDisplay: true,
      address: result,
    });
    $ethResults.val(result);
  } else {
    let label = await wallet.getLabel();
    $ethResults.val(label + " does not support ETH");
  }
});

$ethTx.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ethResults.val("No wallet?");
    return;
  }
  if (supportsETH(wallet)) {
    let res = await wallet.ethSignTx({
      addressNList: bip32ToAddressNList("m/44'/60'/0'/0/0"),
      nonce: "0x0",
      gasPrice: "0x5FB9ACA00",
      gasLimit: "0x186A0",
      value: "0x00",
      to: "0x41e5560054824ea6b0732e656e3ad64e20e94e45",
      chainId: 1,
      data:
        "0x" +
        "a9059cbb000000000000000000000000" +
        "9BB9E5bb9b04e8CE993104309A1f180feBf63DB6" +
        "0000000000000000000000000000000000000000000000000000000005F5E100",
    });
    $ethResults.val(JSON.stringify(res));
  } else {
    let label = await wallet.getLabel();
    $ethResults.val(label + " does not support ETH");
  }
});

$ethSign.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ethResults.val("No wallet?");
    return;
  }
  if (supportsETH(wallet)) {
    let { hardenedPath: hard, relPath: rel } = wallet.ethGetAccountPaths({
      coin: "Ethereum",
      accountIdx: 0,
    })[0];
    let result = await wallet.ethSignMessage({
      addressNList: hard.concat(rel),
      message: "Hello World",
    });
    $ethResults.val(result.address + ", " + result.signature);
  } else {
    let label = await wallet.getLabel();
    $ethResults.val(label + " does not support ETH");
  }
});

$ethVerify.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ethResults.val("No wallet?");
    return;
  }
  if (supportsETH(wallet)) {
    let result = await wallet.ethVerifyMessage({
      address: "0x2068dD92B6690255553141Dfcf00dF308281f763",
      message: "Hello World",
      signature:
        "61f1dda82e9c3800e960894396c9ce8164fd1526fccb136c71b88442405f7d09721725629915d10bc7cecfca2818fe76bc5816ed96a1b0cebee9b03b052980131b",
    });
    $ethResults.val(result ? "✅" : "❌");
  } else {
    let label = await wallet.getLabel();
    $ethResults.val(label + " does not support ETH");
  }
});

/*
      Bitcoin
        * segwit: false
        * mutltisig: true

*/
const $btcAddr = $("#btcAddr");
const $btcTx = $("#btcTx");
const $btcSign = $("#btcSign");
const $btcVerify = $("#btcVerify");
const $btcResults = $("#btcResults");

$btcAddr.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $btcResults.val("No wallet?");
    return;
  }
  if (supportsBTC(wallet)) {
    //coin 0 (mainnet bitcoin)
    //path 0
    let res = await wallet.btcGetAddress({
      addressNList: [0x80000000 + 44, 0x80000000 + 0, 0x80000000 + 0, 0, 0],
      coin: "Bitcoin",
      scriptType: BTCInputScriptType.SpendAddress,
      showDisplay: true,
    });
    $btcResults.val(res);
  } else {
    let label = await wallet.getLabel();
    $btcResults.val(label + " does not support BTC");
  }
});

$btcTx.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $btcResults.val("No wallet?");
    return;
  }
  if (supportsBTC(wallet)) {
    const txid =
      "b3002cd9c033f4f3c2ee5a374673d7698b13c7f3525c1ae49a00d2e28e8678ea";
    const hex =
      "010000000181f605ead676d8182975c16e7191c21d833972dd0ed50583ce4628254d28b6a3010000008a47304402207f3220930276204c83b1740bae1da18e5a3fa2acad34944ecdc3b361b419e3520220598381bdf8273126e11460a8c720afdbb679233123d2d4e94561f75e9b280ce30141045da61d81456b6d787d576dce817a2d61d7f8cb4623ee669cbe711b0bcff327a3797e3da53a2b4e3e210535076c087c8fb98aef60e42dfeea8388435fc99dca43ffffffff0250ec0e00000000001976a914f7b9e0239571434f0ccfdba6f772a6d23f2cfb1388ac10270000000000001976a9149c9d21f47382762df3ad81391ee0964b28dd951788ac00000000";

    let inputs = [
      {
        addressNList: [0x80000000 + 44, 0x80000000 + 0, 0x80000000 + 0, 0, 0],
        scriptType: BTCInputScriptType.SpendAddress,
        amount: String(14657949219),
        vout: 0,
        txid: txid,
        tx: btcTxJson,
        hex,
      },
    ];

    let outputs = [
      {
        address: "1MJ2tj2ThBE62zXbBYA5ZaN3fdve5CPAz1",
        addressType: BTCOutputAddressType.Spend,
        scriptType: BTCOutputScriptType.PayToAddress,
        amount: String(390000 - 10000),
        isChange: false,
      },
    ];
    let res = await wallet.btcSignTx({
      coin: "Bitcoin",
      inputs: inputs,
      outputs: outputs,
      version: 1,
      locktime: 0,
    });
    $btcResults.val(res.serializedTx);
  } else {
    let label = await wallet.getLabel();
    $btcResults.val(label + " does not support BTC");
  }
});

$btcSign.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $btcResults.val("No wallet?");
    return;
  }
  if (supportsBTC(wallet)) {
    let res = await wallet.btcSignMessage({
      addressNList: bip32ToAddressNList("m/44'/0'/0'/0/0"),
      coin: "Bitcoin",
      scriptType: BTCInputScriptType.SpendAddress,
      message: "Hello World",
    });
    $btcResults.val(res.address + " " + res.signature);
  } else {
    let label = await wallet.getLabel();
    $btcResults.val(label + " does not support BTC");
  }
});

$btcVerify.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $btcResults.val("No wallet?");
    return;
  }
  if (supportsBTC(wallet)) {
    let res = await wallet.btcVerifyMessage({
      address: "1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM",
      coin: "Bitcoin",
      signature:
        "20a037c911044cd6c851b6508317d8892067b0b62074b2cf1c0df9abd4aa053a3c243ffdc37f64d7af2c857128eafc81947c380995596615e5dcc313a15f512cdd",
      message: "Hello World",
    });
    $btcResults.val(res ? "✅" : "❌");
  } else {
    let label = await wallet.getLabel();
    $btcResults.val(label + " does not support BTC");
  }
});

/*
      Litecoin
        * segwit: true
        * mutltisig: true

*/
const $ltcAddr = $("#ltcAddr");
const $ltcTx = $("#ltcTx");
const $ltcSign = $("#ltcSign");
const $ltcVerify = $("#ltcVerify");
const $ltcResults = $("#ltcResults");

const ltcBip44 = {
  scriptType: BTCInputScriptType.SpendAddress,
  addressNList: [0x80000000 + 44, 0x80000000 + 2, 0x80000000 + 0, 0, 0],
};

$ltcAddr.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ltcResults.val("No wallet?");
    return;
  }
  if (supportsBTC(wallet)) {
    let res = await wallet.btcGetAddress({
      addressNList: ltcBip44.addressNList,
      coin: "Litecoin",
      scriptType: ltcBip44.scriptType,
      showDisplay: true,
    });
    $ltcResults.val(res);
  } else {
    let label = await wallet.getLabel(); // should be LYXTv5RdsPYKC4qGmb6x6SuKoFMxUdSjLQ
    $ltcResults.val(label + " does not support Litecoin");
  }
});

$ltcTx.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ltcResults.val("No wallet?");
    return;
  }
  if (supportsBTC(wallet)) {
    const txid =
      "1de79c706f34c81bbefad49a9ff8d12b6ca86b77605a1998505e4f8792a5892d";
    const hex =
      "010000000196f5704ef948abb958f32ff216112d3283142baf50723833c378882c14a9adea010000006a47304402207c899ba5197a23b1f3cc4b3621abbc682b5142f3ae29af4b951952573f6c82a002203fd7f038aa8403d2c06fd32c237ab4e915939c25aafa7bcb06fb0ddd46afbfd3012103eddbce765b6d7ae1c91b779696e8b8f72ce444070f83beba2f823af76fd4dfebffffffff0290680a00000000001976a91491e975a0238fa1dfff703e50f062e2544a3e372088aca6791100000000001976a91415757f526dc67b52ae9f74918db532eebc39608688ac00000000";

    const inputs = [
      {
        addressNList: ltcBip44.addressNList,
        scriptType: BTCInputScriptType.SpendAddress,
        amount: String(2160258),
        vout: 0,
        txid,
        segwit: false,
        tx: ltcTxJson,
        hex,
      },
    ];

    const outputs = [
      {
        address: "LLe4PciAJgMMJSAtQQ5nkC13t6SSMmERJ3",
        addressType: BTCOutputAddressType.Spend,
        scriptType: BTCOutputScriptType.PayToAddress,
        amount: String(261614),
        isChange: false,
      },
    ];

    const res = await wallet.btcSignTx({
      coin: "Litecoin",
      inputs,
      outputs,
      version: 1,
      locktime: 0,
    });
    $ltcResults.val(res.serializedTx);
  } else {
    let label = await wallet.getLabel();
    $ltcResults.val(label + " does not support Litecoin");
  }
});

$ltcSign.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ltcResults.val("No wallet?");
    return;
  }
  if (supportsBTC(wallet)) {
    let res = await wallet.btcSignMessage({
      addressNList: ltcBip44.addressNList,
      coin: "Litecoin",
      scriptType: BTCInputScriptType.SpendAddress,
      message: "Hello World",
    });
    $ltcResults.val(res.address + " " + res.signature);
    // Address: LYXTv5RdsPYKC4qGmb6x6SuKoFMxUdSjLQ
    // Signature: 1f835c7efaf953e059e7074afa954c5a8535be321f48e393e125e2a839d1721b495b935df1162c2b69f3e698167b75ab8bfd2c9c203f6070ff701ebca49653a056
  } else {
    let label = await wallet.getLabel();
    $ltcResults.val(label + " does not support Litecoin");
  }
});

/*
      Dogecoin
        * segwit: false
        * mutltisig: true

 */

const $dogeAddr = $("#dogeAddr");
const $dogeTx = $("#dogeTx");
const $dogeResults = $("#dogeResults");

const dogeBip44 = {
  scriptType: BTCInputScriptType.SpendAddress,
  addressNList: [0x80000000 + 44, 0x80000000 + 3, 0x80000000 + 0],
};
$dogeAddr.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $dogeResults.val("No wallet?");
    return;
  }
  if (supportsBTC(wallet)) {
    let res = await wallet.btcGetAddress({
      addressNList: dogeBip44.addressNList.concat([0, 0]),
      coin: "Dogecoin",
      scriptType: dogeBip44.scriptType,
      showDisplay: true,
    });
    $dogeResults.val(res);
  } else {
    let label = await wallet.getLabel(); // should be DQTjL9vfXVbMfCGM49KWeYvvvNzRPaoiFp for alcohol abuse
    $dogeResults.val(label + " does not support DOGE");
  }
});

$dogeTx.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $dogeResults.val("No wallet?");
    return;
  }
  if (supportsBTC(wallet)) {
    const txid =
      "4ab8c81585bf61ddcba03f4b2f4958b3800d68b02874f4955e258775cb3e7068";
    const hex =
      "01000000048831c8a8c7f06e5f4ecccb789cc9de0fc843208797652ff9edf6edaa64d02789010000006a473044022070e25a73ceebaf5b3a35d5e4930ebba77957a2fe485b9dcbaf982a7c63d4baab02206e75dcc4258db29a2803d6a14112d3d81f93ec23f9b2a61bfe8102d764d7c6390121031b49bb2c43daac784377bcca83c41f781007626e6e8b66cda9f57fed11494359feffffff52a8a6ac8ea9b436069c160caae68b2eb0a5b713a7b838179833af5a339e48e9000000006a47304402206b3aa1a4656d4859b87512a5fb50c73f0f6e05d45fa027850a3e1eb4f927675402201fb1c52d85380727d28bea7a21d434bed2d57d3a120082c6c69d578b4f3da07c0121033034cf66b3b153a81713b3ddbcdffd92c34c46510353cf01b237fcfbcf1348bdfeffffff35f6938fd9d9077d913bd6cfc546cbadb17d4db6ccb67d87a1f89e562d6bed8e000000006b483045022100a0e8a73fc2358a206a73a78582fd7ebba2fb08487aca78aaa89cbf7f9805da0102207704f4f27ff6297b11acd74f8e3f28d924c4006ac0d37dd37bbdba1ef8f401ae0121038ac65cabea63b92d3aabd3f17591c23bbec73b87220a3f0325fe2de9e62107e3feffffff07cd534960ea57fdb4195d3de7dae1feb1e630a022c08baca2f2423f4d190a27010000006a47304402203c89ade05e93ee9cb9bfa0703be55a76abd40330108a5e5272bcd0c8338c35df022042d8cb34275e87df1b77f19e9dde5da553b98bca67c1c332a53392b32d55ba580121038291eee31aa046a00938dda548c0c948f57bf5dc6e534abbe0d5078a6ce083a0feffffff02b8adfa31000000001976a9146ef1cda5c24d47934853aeccce14163e3a18be1388ac02bd9348080000001976a914d3f096cbc84bd6daf7e7fe2700c32548ca2f23f188acadd31600";

    const inputs = [
      {
        addressNList: dogeBip44.addressNList.concat([0, 0]),
        scriptType: BTCInputScriptType.SpendAddress,
        amount: String(14657949219),
        vout: 0,
        txid: txid,
        segwit: false,
        tx: dogeTxJson,
        hex,
      },
    ];

    const outputs = [
      {
        address: "DMEHVGRsELY5zyYbfgta3pAhedKGeaDeJd",
        addressType: BTCOutputAddressType.Spend,
        scriptType: BTCOutputScriptType.PayToAddress,
        amount: String(14557949219),
        isChange: false,
      },
    ];

    const res = await wallet.btcSignTx({
      coin: "Dogecoin",
      inputs,
      outputs,
      version: 1,
      locktime: 0,
    });
    $dogeResults.val(res.serializedTx); // TODO: Fails for Ledger: "TransportStatusError: Ledger device: Invalid data received (0x6a80)"
  } else {
    let label = await wallet.getLabel();
    $dogeResults.val(label + " does not support Litecoin");
  }
});

/*
      Bitcoin Cash
        * segwit: false
        * mutltisig: true

 */

const $bchAddr = $("#bchAddr");
const $bchTx = $("#bchTx");
const $bchResults = $("#bchResults");

const bchBip44 = {
  scriptType: BTCInputScriptType.SpendAddress,
  addressNList: [0x80000000 + 44, 0x80000000 + 145, 0x80000000 + 0],
};

$bchAddr.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $bchResults.val("No wallet?");
    return;
  }
  if (supportsBTC(wallet)) {
    let res = await wallet.btcGetAddress({
      addressNList: bchBip44.addressNList.concat([0, 0]),
      coin: "BitcoinCash",
      scriptType: bchBip44.scriptType,
      showDisplay: true,
    });
    $bchResults.val(res);
  } else {
    let label = await wallet.getLabel(); // KK: bitcoincash:qzqxk2q6rhy3j9fnnc00m08g4n5dm827xv2dmtjzzp or Ledger: 1Ci1rvsLpZqvaMLSq7LiFj6mfnV4p3833E
    $bchResults.val(label + " does not support BCH");
  }
});

$bchTx.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $bchResults.val("No wallet?");
    return;
  }
  if (supportsBTC(wallet)) {
    const txid =
      "35ec5b47eea3b45efb062c6fabad43987a79b855dc42630b34f8d26d4a646a2e";
    const hex =
      "0100000002a90f75f5924be1fb8147885f6212fefeed3d192eb23a737265f01c822aa74be9000000006b48304502210092dbd26379c6a707b5974bf9ce242baf151a2cef95a5644f6bd4fa05bcbf433e0220125c3647fe473a7e9bf89cb092e1f5e2b26f10a33a12c23b2cfbf2bb1d72c6324121035942ab1589fb2f85c0b3e0c9a37b8ea3092ac749fcbc20733ed227322b5da9ecffffffffbaa5bc3a01a705c377b3ee88ae21ca70ee9d3694f05c466f420cc2bd1951afe5000000006b483045022100a79147c5cf806a2bb3bb6619113cc4bf9b522aaf529ea1b34a93b99bd33054020220019df030c623c9e782f23e755fa9259ec708427606cce8302d5a125e4147838a4121035942ab1589fb2f85c0b3e0c9a37b8ea3092ac749fcbc20733ed227322b5da9ecffffffff0188c7d200000000001976a914806b281a1dc91915339e1efdbce8ace8dd9d5e3388ac00000000";

    const inputs = [
      {
        addressNList: bchBip44.addressNList.concat([0, 0]),
        scriptType: BTCInputScriptType.SpendAddress,
        amount: String(1567200),
        vout: 0,
        txid: txid,
        segwit: false,
        hex,
      },
    ];

    const outputs = [
      {
        address: (await wallet.btcSupportsScriptType(
          "BitcoinCash",
          BTCInputScriptType.CashAddr
        ))
          ? "bitcoincash:qq5mg2xtp9y5pvvgy7m4k2af5a7s5suulueyywgvnf"
          : "14oWXZFPhgP9DA3ggPzhHpUUaikDSjAuMC",
        addressType: BTCOutputAddressType.Spend,
        scriptType: BTCOutputScriptType.PayToAddress,
        amount: String(1567200),
        isChange: false,
      },
    ];

    const res = await wallet.btcSignTx({
      coin: "BitcoinCash",
      inputs,
      outputs,
      version: 1,
      locktime: 0,
    });
    $bchResults.val(res.serializedTx);
  } else {
    let label = await wallet.getLabel();
    $bchResults.val(label + " does not support Litecoin");
  }
});

/*
       Dash
        * segwit: false
        * mutltisig: true

 */

const $dashAddr = $("#dashAddr");
const $dashTx = $("#dashTx");
const $dashResults = $("#dashResults");

const dashBip44 = {
  scriptType: BTCInputScriptType.SpendAddress,
  addressNList: [0x80000000 + 44, 0x80000000 + 5, 0x80000000 + 0],
};

$dashAddr.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $dashResults.val("No wallet?");
    return;
  }
  if (supportsBTC(wallet)) {
    let res = await wallet.btcGetAddress({
      addressNList: dashBip44.addressNList.concat([0, 0]),
      coin: "Dash",
      scriptType: dashBip44.scriptType,
      showDisplay: true,
    });
    $dashResults.val(res);
  } else {
    let label = await wallet.getLabel();
    $dashResults.val(label + " does not support Dash");
  }
});

$dashTx.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $dashResults.val("No wallet?");
    return;
  }
  if (supportsBTC(wallet)) {
    const txid =
      "0602c9ef3c74de624f1bc613a79764e5c51650b4cc0d076547061782baeeabdb";
    const hex =
      "0100000001ca2abfc4e998a904d9591ba0e7ac506c2e6eb6fb6cfd23dab3edf8525f5966b3000000006a47304402200452d3ad2aefe2b712c1eae89d1b96df5016570c7fcda3dcb49fd7ae51fe97a102201fe2a70aafb5355c4e4b5db8d98724df4e38e2951caef3cbb9b690d909922cbe0121036ac34cb12ac492c0eb0d1a07bd73a5a5f08bc6ba27b710276073704de9912921ffffffff01834f3b01000000001976a914546dabff283c7d6cf56dd85b5e5d3a4150449db688ac00000000";

    const inputs = [
      {
        addressNList: dashBip44.addressNList.concat([0, 0]),
        scriptType: BTCInputScriptType.SpendAddress,
        amount: String(20654195),
        vout: 0,
        txid: txid,
        segwit: false,
        tx: dashTxJson,
        hex,
      },
    ];

    const outputs = [
      {
        address: "XexybzTUtH9V9eY4UJN2aCcBT3utan5C8N",
        addressType: BTCOutputAddressType.Spend,
        scriptType: BTCOutputScriptType.PayToAddress,
        amount: String(20664195),
        isChange: false,
      },
    ];

    const res = await wallet.btcSignTx({
      coin: "Dash",
      inputs,
      outputs,
      version: 1,
      locktime: 0,
    });
    $dashResults.val(res.serializedTx);
  } else {
    let label = await wallet.getLabel();
    $dashResults.val(label + " does not support Dash");
  }
});

/*
       DigiByte
        * segwit: true
        * multisig: true

 */
const $dgbAddr = $("#dgbAddr");
const $dgbTx = $("#dgbTx");
const $dgbResults = $("#dgbResults");

const dgbBip44 = {
  scriptType: BTCInputScriptType.SpendAddress,
  addressNList: [0x80000000 + 44, 0x80000000 + 20, 0x80000000 + 0],
};

$dgbAddr.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $dgbResults.val("No wallet?");
    return;
  }
  if (supportsBTC(wallet)) {
    let res = await wallet.btcGetAddress({
      addressNList: dgbBip44.addressNList.concat([0, 0]),
      coin: "DigiByte",
      scriptType: dgbBip44.scriptType,
      showDisplay: true,
    });
    $dgbResults.val(res);
  } else {
    let label = await wallet.getLabel();
    $dgbResults.val(label + " does not support Dash");
  }
});

$dgbTx.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $dgbResults.val("No wallet?");
    return;
  }
  if (supportsBTC(wallet)) {
    const inputs = [
      {
        addressNList: dgbBip44.addressNList.concat([1, 8]),
        scriptType: BTCInputScriptType.SpendAddress,
        amount: String(6296665274),
        vout: 1,
        txid:
          "e105f91187880e76fef52021866f5b8eed6654d89ee38ea2046729a89b91dd9d",
        tx: null,
        hex:
          "0100000001c12804112b0eb2a57fd31674d6873376a11b22cdd30528c577ebaff1bd94f7d7000000006b483045022100939aa562ce80f49e959e6a65be95a8cef72c8d0363a191ff583556727bc56cf00220583fb9d7e9748c8df0489ed3d5d12d5c046bcc48413fa207dc5b8ae5aec02871012103d9225136ed8d7152b5a7b11fc8da236fe4221b1d5ae84ca458ef9f3aaa2d2335ffffffff02b95012dc1000000017a914bf98b6dea3c0d8b4be2d2855a0ca9bbdf06427e487ba7c4f77010000001976a914642bc1a3baac46e913f63c8c6b0a5572e221a90088ac00000000",
      },
      {
        addressNList: dgbBip44.addressNList.concat([0, 5]),
        scriptType: BTCInputScriptType.SpendAddress,
        amount: String(81931969674),
        vout: 0,
        txid:
          "eb46d956987d83edf39dea4f469e6fb96fb83626b2f0122a3e6592944047b971",
        tx: null,
        hex:
          "0100000001c154deb896c45ea6c48313b79a8e6f5cb5637e489c1d50b62165dbd814955f29000000006a47304402206800f2e2496ebb637fab73aefee03d668fad979f6ee164479cedfdd134d5dd6c0220449d593cf638f455e37aebc54acfc177993f9244ad4c7b86bc3cac77d5d45b000121025306e93111a17603bf8e3d9dddc1a9215bbba1177779837978cd80544755f854ffffffff018aa48613130000001976a9145473f9ceaedb87e3d57d6c946e41c1fc1e99bb8988ac00000000",
      },
    ];

    const outputs = [
      {
        address: "SWpe93hQL2pLUDLy7swsDPWQJGCHSsgmun",
        addressType: null,
        scriptType: BTCOutputScriptType.PayToMultisig,
        amount: String(49408035571),
        isChange: false,
      },
      {
        address: "DNLcBry65dHehGExGYjBkM8kxDYr7mZ3BT",
        addressType: null,
        scriptType: BTCOutputScriptType.PayToAddress,
        relpath: "1/9",
        amount: String(38820597425),
        isChange: true,
        index: 9,
      },
    ];

    const res = await wallet.btcSignTx({
      coin: "DigiByte",
      inputs,
      outputs,
      version: 1,
      locktime: 0,
    });
    $dgbResults.val(res.serializedTx);
  } else {
    let label = await wallet.getLabel();
    $dgbResults.val(label + " does not support Dash");
  }
});

/*
      Bitcoin (segwit)
        * segwit: true
        * mutltisig: true
 */

const $btcAddrSegWit = $("#btcAddrSegWit");
const $btcAddrSegWitNative = $("#btcAddrSegWitNative");
const $btcTxSegWit = $("#btcTxSegWit");
const $btcTxSegWitNative = $("#btcTxSegWitNative");
const $btcResultsSegWit = $("#btcResultsSegWit");

$btcAddrSegWit.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $btcResultsSegWit.val("No wallet?");
    return;
  }
  if (supportsBTC(wallet)) {
    //coin 0 (mainnet bitcoin)
    //path 0
    let res = await wallet.btcGetAddress({
      addressNList: [0x80000000 + 49, 0x80000000 + 0, 0x80000000 + 0, 0, 0],
      coin: "Bitcoin",
      scriptType: BTCInputScriptType.SpendP2SHWitness,
      showDisplay: true,
    });

    $btcResultsSegWit.val(res);
  } else {
    let label = await wallet.getLabel();
    $btcResultsSegWit.val(label + " does not support BTC");
  }
});

$btcAddrSegWitNative.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $btcResultsSegWit.val("No wallet?");
    return;
  }
  if (supportsBTC(wallet)) {
    //coin 0 (mainnet bitcoin)
    //path 0
    let res = await wallet.btcGetAddress({
      addressNList: [0x80000000 + 84, 0x80000000 + 0, 0x80000000 + 0, 0, 0],
      coin: "Bitcoin",
      scriptType: BTCInputScriptType.SpendWitness,
      showDisplay: true,
    });
    $btcResultsSegWit.val(res);
  } else {
    let label = await wallet.getLabel();
    $btcResultsSegWit.val(label + " does not support BTC");
  }
});

$btcTxSegWit.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $btcResultsSegWit.val("No wallet?");
    return;
  }
  if (supportsBTC(wallet)) {
    const txid =
      "609410a9eac51cdce2b9c1911c7b8705bc566e164bca07ae25f2dee87b5b6a91";
    const hex =
      "01000000021b09436d8f9fae331e8810ca8ddf5b2bac1c95338a98280ad75efb6773d54a03000000006b48304502210081734b9b58d109997241c85806e6a5c97ba79f4a76ddb98eb227626b21ac1d290220534bee7f3f2a1803b851570b62825a589b5989f69afa44ddee5b591b8f822d3d012103fa044f4e622a9dc7a877155efad20816c6994f95bd1dc21c339a820395a32e01ffffffffe4b64ecf01f1b2e2a8c0ca86662fada7abbb991e9b4974217f5977623d515ea1010000006b4830450221008a2c95c61db777e15ebb7220c9a84565080ed87b97778a0417854fefa87e447202205dafb62309770a98868737d25bc7779caffa4b50993c36c93acf1f07a5d6d69b012102000b4b1051a63e82eeede1f1990ab226685f83ba104a0946edc740e17ce2958bffffffff02a08601000000000017a91463c4b3af0eb54b8b58b07fbde95a4ab3af3b8735874f161100000000001976a91430f7daeb4336f786cb0cf3bb162d83393681ca2d88ac00000000";

    let inputs = [
      {
        addressNList: [0x80000000 + 49, 0x80000000 + 0, 0x80000000 + 0, 0, 0],
        amount: String(100000),
        vout: 0,
        txid: txid,
        scriptType: BTCInputScriptType.SpendP2SHWitness,
        tx: btcSegWitTxJson,
        hex,
      },
    ];

    let outputs = [
      {
        address: "3Eq3agTHEhMCC8sZHnJJcCcZFB7BBSJKWr",
        addressType: BTCOutputAddressType.Spend,
        scriptType: BTCOutputScriptType.PayToAddress,
        amount: String(89869),
      },
    ];
    let res = await wallet.btcSignTx({
      coin: "Bitcoin",
      inputs: inputs,
      outputs: outputs,
      version: 1,
      locktime: 0,
    });
    $btcResultsSegWit.val(res.serializedTx);
  } else {
    let label = await wallet.getLabel();
    $btcResultsSegWit.val(label + " does not support BTC");
  }
});

$btcTxSegWitNative.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $btcResultsSegWit.val("No wallet?");
    return;
  }
  if (supportsBTC(wallet)) {
    const txid =
      "2a873672cd30bfe60f05f16db4cadec26677af0971d8fd250aa0ea1bdd8e5942";
    const hex =
      "01000000016f992bb21c320dc0c1e906cd84a6a7aeb99da073e6a16ec0717a89827fd1a09d010000006b483045022100ecbc1d0613dedbc7ce8a9b92fe1bb96750ad5e613000046f9a609dca07518718022024613e251c64f97a14021a30b58a6833823a25c4b5aecf0a8d446cec01316ee1012103d8a07c480c7b3d665cf6b0f83989a34ee2c7dad91c18b8cae7633e9ec7413b18ffffffff02a086010000000000160014329035c39cb274eb9cdaa662a7ab0eaaae15612b7f7d0b00000000001976a914f81af3e36a72aceab07c54bf4afa66b23d7bc15288ac00000000";

    let inputs = [
      {
        addressNList: [0x80000000 + 84, 0x80000000 + 0, 0x80000000 + 0],
        amount: String(100000),
        vout: 0,
        txid: txid,
        scriptType: BTCInputScriptType.SpendWitness,
        tx: btcBech32TxJson,
        hex,
      },
    ];

    let outputs = [
      {
        address: "bc1qc5dgazasye0yrzdavnw6wau5up8td8gdqh7t6m",
        addressType: BTCOutputAddressType.Spend,
        scriptType: BTCOutputScriptType.PayToAddress,
        amount: String(89869),
      },
    ];
    let res = await wallet.btcSignTx({
      coin: "Bitcoin",
      inputs: inputs,
      outputs: outputs,
      version: 1,
      locktime: 0,
    });
    $btcResultsSegWit.val(res.serializedTx);
  } else {
    let label = await wallet.getLabel();
    $btcResultsSegWit.val(label + " does not support BTC");
  }
});
