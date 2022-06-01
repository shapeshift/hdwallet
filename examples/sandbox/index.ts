import "regenerator-runtime/runtime";

import * as core from "@shapeshiftoss/hdwallet-core";
import * as keepkey from "@shapeshiftoss/hdwallet-keepkey";
import * as keepkeyTcp from "@shapeshiftoss/hdwallet-keepkey-tcp";
import * as keepkeyWebUSB from "@shapeshiftoss/hdwallet-keepkey-webusb";
import * as keplr from "@shapeshiftoss/hdwallet-keplr";
import * as ledgerWebHID from "@shapeshiftoss/hdwallet-ledger-webhid";
import * as ledgerWebUSB from "@shapeshiftoss/hdwallet-ledger-webusb";
import * as metaMask from "@shapeshiftoss/hdwallet-metamask";
import * as native from "@shapeshiftoss/hdwallet-native";
import * as portis from "@shapeshiftoss/hdwallet-portis";
import * as tallyHo from "@shapeshiftoss/hdwallet-tallyho";
import * as trezorConnect from "@shapeshiftoss/hdwallet-trezor-connect";
import * as xdefi from "@shapeshiftoss/hdwallet-xdefi";
import $ from "jquery";
import Web3 from "web3";

import * as bnbTxJson from "./json/bnbTx.json";
import * as btcBech32TxJson from "./json/btcBech32Tx.json";
import * as btcSegWitTxJson from "./json/btcSegWitTx.json";
import * as btcTxJson from "./json/btcTx.json";
import {
  cosmosDelegateTx,
  cosmosIBCTransferTx,
  cosmosRedelegateTx,
  cosmosRewardsTx,
  cosmosTransferTx,
  cosmosUndelegateTx,
} from "./json/cosmosAminoTx.json";
import * as dashTxJson from "./json/dashTx.json";
import * as dogeTxJson from "./json/dogeTx.json";
import * as ltcTxJson from "./json/ltcTx.json";
import * as rippleTxJson from "./json/rippleTx.json";
import {
  thorchainBinanceBaseTx,
  thorchainBitcoinBaseTx,
  thorchainEthereumBaseTx,
  thorchainNativeRuneBaseTx,
  thorchainRouterAbi,
  thorchainUnsignedTx,
} from "./json/thorchainTx.json";

const keyring = new core.Keyring();

const portisAppId = "ff763d3d-9e34-45a1-81d1-caa39b9c64f9";
const mnemonic = "alcohol woman abuse must during monitor noble actual mixed trade anger aisle";

const testPublicWalletXpubs = [
  "xpub661MyMwAqRbcFLgDU7wpcEVubSF7NkswwmXBUkDiGUW6uopeUMys4AqKXNgpfZKRTLnpKQgffd6a2c3J8JxLkF1AQN17Pm9QYHEqEfo1Rsx", // all seed root key
  "xpub68Zyu13qjcQxDzLNfTYnUXtJuX2qJgnxP6osrcAvJGdo6bs9M2Adt2BunbwiYrZS5qpA1QKoMf3uqS2NHpbyZp4KMJxDrL58NTyvHXBeAv6", // all seed m/44'
  "xpub6APRH5kELakva27TFbzpfhfsY3Jd4dRGo7NocHb63qWecSgK2dUkjWaYevJsCunicpdAkPg9fvHAdpSFMDCMCDMit8kiTM1w9QoGmfyVwDo", // all seed m/44'/0'
  "xpub6BiVtCpG9fQPxnPmHXG8PhtzQdWC2Su4qWu6XW9tpWFYhxydCLJGrWBJZ5H6qTAHdPQ7pQhtpjiYZVZARo14qHiay2fvrX996oEP42u8wZy", // all seed m/44'/0'/0'
  "xpub6APRH5kELakyDsZMmBU9HEoeRUzM9F8STp6ztXLPUJQLiXGrbsfACbngkw5vySPfa9vFs2p3kMsRPxhyDTLhKYEf5HLVfDcDuTTazgzvArk", // all seed m/44'/60'
  "xpub6CNFa58kEQJu2hwMVoofpDEKVVSg6gfwqBqE2zHAianaUnQkrJzJJ42iLDp7Dmg2aP88qCKoFZ4jidk3tECdQuF4567NGHDfe7iBRwHxgke", // all seed m/44'/60'/0'
  "xpub68Zyu13qjcQxUZiesSWiHJMqkg8G8Guft6MvDhwP72zSYXr9iKnNmDo7LxuSVwtpamrNwGQHkGDWoK8MAp3S9GW5fVxsjBY6AdvZc1hB7kK", // all seed m/49'
  "xpub6AA5piovovuKytxa5QtBWAbixSjg7fbmu5gqs6QmvARrUMgewJV51roNH4M7GtvZmjBY1m5oAgAjoHivasewSh4S2H7LAikCyuhJxfHdSsK", // all seed m/49'/0'
  "xpub6CVKsQYXc9awxgV1tWbG4foDvdcnieK2JkbpPEBKB5WwAPKBZ1mstLbKVB4ov7QzxzjaxNK6EfmNY5Jsk2cG26EVcEkycGW4tchT2dyUhrx", // all seed m/49'/0'/0'
  "xpub68Zyu13qjcQz2DTzkBfLNCfsCTgT39rsUY9JT7MFvG3oEJvS8gUYwRX4RheUTFGZ6EtW4dFYhCdBX32GHJCodkQLAARjNsw4Drj1oDxvo9p", // all seed m/84'
  "xpub69s3dQnszuX49hTwhNAQEMJyTcRQNZyhtKAqNgQXApquzXdR3fEjXg75ScXzMMMLkUjQnz2Giwt2L7vesiswkAYwzbHezaUXayU8Z81CW56", // all seed m/84'/0'
  "xpub6DDUPHpUo4pcy43iJeZjbSVWGav1SMMmuWdMHiGtkK8rhKmfbomtkwW6GKs1GGAKehT6QRocrmda3WWxXawpjmwaUHfFRXuKrXSapdckEYF", // all seed m/84'/0'/0'
].join(" ");

const keepkeyAdapter = keepkeyWebUSB.WebUSBKeepKeyAdapter.useKeyring(keyring);
const kkbridgeAdapter = keepkeyTcp.TCPKeepKeyAdapter.useKeyring(keyring);
const kkemuAdapter = keepkeyTcp.TCPKeepKeyAdapter.useKeyring(keyring);
const portisAdapter = portis.PortisAdapter.useKeyring(keyring, { portisAppId });
const metaMaskAdapter = metaMask.MetaMaskAdapter.useKeyring(keyring);
const tallyHoAdapter = tallyHo.TallyHoAdapter.useKeyring(keyring);
const xdefiAdapter = xdefi.XDEFIAdapter.useKeyring(keyring);
const keplrAdapter = keplr.KeplrAdapter.useKeyring(keyring);
const nativeAdapter = native.NativeAdapter.useKeyring(keyring, {
  mnemonic,
  deviceId: "native-wallet-test",
});
const trezorAdapter = trezorConnect.TrezorAdapter.useKeyring(keyring, {
  debug: false,
  manifest: {
    email: "oss@shapeshiftoss.io",
    appUrl: "https://shapeshift.com",
  },
});
const ledgerWebUSBAdapter = ledgerWebUSB.WebUSBLedgerAdapter.useKeyring(keyring);
const ledgerWebHIDAdapter = ledgerWebHID.WebHIDLedgerAdapter.useKeyring(keyring);

window["keyring"] = keyring;

window.localStorage.debug = "*";

let wallet;
window["wallet"] = wallet;

const $keepkey = $("#keepkey");
const $keepkeybridge = $("#keepkeybridge");
const $kkemu = $("#kkemu");
const $trezor = $("#trezor");
const $ledgerwebusb = $("#ledgerwebusb");
const $ledgerwebhid = $("#ledgerwebhid");
const $portis = $("#portis");
const $native = $("#native");
const $metaMask = $("#metaMask");
const $tallyHo = $("#tallyHo");
const $xdefi = $("#xdefi");
const $keplr = $("#keplr");
const $keyring = $("#keyring");

const $ethAddr = $("#ethAddr");
const $ethTx = $("#ethTx");
const $ethSign = $("#ethSign");
const $ethSend = $("#ethSend");
const $ethVerify = $("#ethVerify");
const $ethResults = $("#ethResults");
const $ethEIP1559 = $("#ethEIP1559");

$keepkey.on("click", async (e) => {
  e.preventDefault();
  wallet = await keepkeyAdapter.pairDevice(undefined, /*tryDebugLink=*/ true);
  window["wallet"] = wallet;
  $("#keyring select").val(await wallet.transport.getDeviceID());
});

$keepkeybridge.on("click", async (e) => {
  e.preventDefault();
  wallet = await kkbridgeAdapter.pairDevice("http://localhost:1646");
  window["wallet"] = wallet;
  $("#keyring select").val(await wallet.transport.getDeviceID());
});

$kkemu.on("click", async (e) => {
  e.preventDefault();
  wallet = await kkemuAdapter.pairDevice("http://localhost:5000");
  window["wallet"] = wallet;
  $("#keyring select").val(await wallet.transport.getDeviceID());
});

$trezor.on("click", async (e) => {
  e.preventDefault();
  wallet = await trezorAdapter.pairDevice();
  window["wallet"] = wallet;
  $("#keyring select").val(await wallet.getDeviceID());
});

$ledgerwebusb.on("click", async (e) => {
  e.preventDefault();
  wallet = await ledgerWebUSBAdapter.pairDevice();
  window["wallet"] = wallet;
  $("#keyring select").val(await wallet.getDeviceID());
});

$ledgerwebhid.on("click", async (e) => {
  e.preventDefault();
  wallet = await ledgerWebHIDAdapter.pairDevice();
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
  } catch (error) {
    console.error(error);
  }
  $("#keyring select").val(deviceId);
});

$native.on("click", async (e) => {
  e.preventDefault();
  wallet = await nativeAdapter.pairDevice("testid");
  window["wallet"] = wallet;
  $("#keyring select").val(await wallet.getDeviceID());
});

$metaMask.on("click", async (e) => {
  e.preventDefault();
  wallet = await metaMaskAdapter.pairDevice();
  window["wallet"] = wallet;
  let deviceID = "nothing";
  try {
    deviceID = await wallet.getDeviceID();
    $("#keyring select").val(deviceID);
  } catch (err) {
    console.error(err);
  }
});

$keplr.on("click", async (e) => {
  e.preventDefault();
  wallet = await keplrAdapter.pairDevice();
  window["wallet"] = wallet;
  let deviceID = "nothing";
  try {
    deviceID = await wallet.getDeviceID();
    $("#keyring select").val(deviceID);
  } catch (error) {
    console.error(error);
  }
});

$tallyHo.on("click", async (e) => {
  e.preventDefault();
  wallet = await tallyHoAdapter.pairDevice();
  window["wallet"] = wallet;
  let deviceID = "nothing";
  try {
    deviceID = await wallet.getDeviceID();
    $("#keyring select").val(deviceID);
  } catch (error) {
    console.error(error);
  }
});

$xdefi.on("click", async (e) => {
  e.preventDefault();
  wallet = await xdefiAdapter.pairDevice("testid");
  window["wallet"] = wallet;
  let deviceID = "nothing";
  try {
    deviceID = await wallet.getDeviceID();
    $("#keyring select").val(deviceID);
  } catch (error) {
    console.error(error);
  }
});

async function deviceConnected(deviceId) {
  wallet = keyring.get(deviceId);
  if (!$keyring.find(`option[value="${deviceId}"]`).length) {
    $keyring.append(
      $("<option></option>")
        .attr("value", deviceId)
        .text(deviceId + " - " + (await wallet.getVendor()))
    );
  }
}

/**
 * START UP
 * Initialize all adapters on page load
 */
(async () => {
  keyring.onAny((name: string[], ...values: any[]) => {
    const [[deviceId, event]] = values;
    const { from_wallet = false, message_type } = event;
    const direction = from_wallet ? "🔑" : "💻";
    console.debug(`${deviceId} ${direction} ${message_type}`, event);

    const log = document.getElementById("eventLog");
    log.innerHTML += `<div class="eventEntry">Event: ${name}<br />Values: ${JSON.stringify(values)}</div>`;
    log.scrollTop = log.scrollHeight;
  });

  keyring.on(["*", "*", core.Events.CONNECT], async (deviceId) => {
    await deviceConnected(deviceId);
  });

  keyring.on(["*", "*", core.Events.DISCONNECT], async (deviceId) => {
    $keyring.find(`option[value="${deviceId}"]`).remove();
  });

  keyring.on(["*", "*", core.Events.PIN_REQUEST], () => window["pinOpen"]());
  keyring.on(["*", "*", core.Events.PASSPHRASE_REQUEST], () => window["passphraseOpen"]());
  keyring.on(["*", "*", native.NativeEvents.MNEMONIC_REQUIRED], () => window["mnemonicOpen"]());

  try {
    await kkbridgeAdapter.pairDevice("http://localhost:1646");
  } catch (e) {
    console.error("Could not initialize keepkey bridge", e);
  }

  try {
    await trezorAdapter.initialize();
  } catch (e) {
    console.error("Could not initialize TrezorAdapter", e);
  }

  try {
    await ledgerWebUSBAdapter.initialize();
  } catch (e) {
    console.error("Could not initialize LedgerWebUSBAdapter", e);
  }

  try {
    await ledgerWebHIDAdapter.initialize();
  } catch (e) {
    console.error("Could not initialize LedgerWebHIDAdapter", e);
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

  try {
    await metaMaskAdapter.initialize();
  } catch (e) {
    console.error("Could not initialize MetaMaskAdapter", e);
  }

  try {
    await tallyHoAdapter.initialize();
  } catch (e) {
    console.error("Could not initialize TallyHoAdapter", e);
  }

  for (const deviceID of Object.keys(keyring.wallets)) {
    await deviceConnected(deviceID);
  }
  $keyring.change(async () => {
    if (wallet) {
      await wallet.disconnect();
    }
    const deviceID = $keyring.find(":selected").val() as string;
    wallet = keyring.get(deviceID);
    if (wallet) {
      if (wallet.transport) {
        await wallet.transport.connect();
        if (keepkey.isKeepKey(wallet)) {
          console.info("try connect debuglink");
          await wallet.transport.tryConnectDebugLink();
        }
      }
      // Initializing a native wallet will immediately prompt for the mnemonic
      if ((await wallet.getModel()) !== "Native") {
        await wallet.initialize();
      }
    }
    window["wallet"] = wallet;
  });
  wallet = keyring.get();
  window["wallet"] = wallet;
  if (wallet) {
    const deviceID = await wallet.getDeviceID();
    $keyring.val(deviceID).change();
  }
})();

window["handlePinDigit"] = function (digit) {
  const input = document.getElementById("#pinInput") as HTMLInputElement;
  if (digit === "") {
    input.value = input.value.slice(0, -1);
  } else {
    input.value += digit.toString();
  }
};

window["pinOpen"] = function () {
  document.getElementById("#pinModal").className = "modal opened";
};

window["pinEntered"] = function () {
  const input = document.getElementById("#pinInput") as HTMLInputElement;
  wallet.sendPin(input.value);
  document.getElementById("#pinModal").className = "modal";
};

window["passphraseOpen"] = function () {
  document.getElementById("#passphraseModal").className = "modal opened";
};

window["passphraseEntered"] = function () {
  const input = document.getElementById("#passphraseInput") as HTMLInputElement;
  wallet.sendPassphrase(input.value);
  document.getElementById("#passphraseModal").className = "modal";
};

window["mnemonicOpen"] = function () {
  document.getElementById("#mnemonicModal").className = "modal opened";
};

window["mnemonicEntered"] = async function () {
  const input = document.getElementById("#mnemonicInput") as HTMLInputElement;
  wallet.loadDevice({ mnemonic: input.value });
  document.getElementById("#mnemonicModal").className = "modal";
};

window["useTestWallet"] = async function () {
  wallet.loadDevice({
    mnemonic: await native.crypto.Isolation.Engines.Dummy.BIP39.Mnemonic.create(testPublicWalletXpubs),
  });
  document.getElementById("#mnemonicModal").className = "modal";
};

const $yes = $("#yes");
const $no = $("#no");
const $cancel = $("#cancel");

$yes.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) return;

  if (!core.supportsDebugLink(wallet)) return;

  await wallet.pressYes();
});

$no.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) return;

  if (!core.supportsDebugLink(wallet)) return;

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
  const vendor = await wallet.getVendor();
  $manageResults.val(vendor);
});

$getModel.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $manageResults.val("No wallet?");
    return;
  }
  const model = await wallet.getModel();
  $manageResults.val(model);
});

$getDeviceID.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $manageResults.val("No wallet?");
    return;
  }
  const deviceID = await wallet.getDeviceID();
  $manageResults.val(deviceID);
});

$getFirmware.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $manageResults.val("No wallet?");
    return;
  }
  const firmware = await wallet.getFirmwareVersion();
  $manageResults.val(firmware);
});

$getLabel.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $manageResults.val("No wallet?");
    return;
  }
  const label = await wallet.getLabel();
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
      scriptType: core.BTCInputScriptType.SpendP2SHWitness,
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
      coin: portis.isPortis(wallet) ? "Bitcoin" : "Ethereum",
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
    mnemonic: /*trezor test seed:*/ "alcohol woman abuse must during monitor noble actual mixed trade anger aisle",
  });
});

const $openApp = $("#openApp");
const $ledgerAppToOpen = $("#ledgerAppToOpen");
const $validateApp = $("#validateApp");
const $ledgerAppToValidate = $("#ledgerAppToValidate");
const $getAppInfo = $("#getAppInfo");
const $appInfo = $("#appInfo");

$ledgerAppToOpen.attr("placeholder", "App name i.e. Bitcoin Cash");
$ledgerAppToValidate.attr("placeholder", "PascalCase coin name i.e. BitcoinCash");

$openApp.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ledgerAppToOpen.val("No wallet?");
    return;
  }
  const appName = $("#ledgerAppToOpen").val();
  if (!appName) {
    $ledgerAppToOpen.val("Please enter app name here");
    return;
  }
  let result = "Check device for prompt";
  $ledgerAppToOpen.val(result);
  try {
    await wallet.openApp(appName);
    result = `${appName} app opened`;
  } catch (err) {
    console.error(err);
    result = err.message;
  }
  $ledgerAppToOpen.val(result);
});

$validateApp.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ledgerAppToValidate.val("No wallet?");
    return;
  }
  const appName = $("#ledgerAppToValidate").val();
  if (!appName) {
    $ledgerAppToValidate.val("Please enter app name here");
    return;
  }
  let result;
  try {
    await wallet.validateCurrentApp(appName);
    result = "Correct app open";
  } catch (err) {
    console.error(err);
    result = err.message;
  }
  $ledgerAppToValidate.val(result);
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
  if (core.supportsBinance(wallet)) {
    const { addressNList } = wallet.binanceGetAccountPaths({ accountIdx: 0 })[0];
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
    const label = await wallet.getLabel();
    $binanceResults.val(label + " does not support Binance");
  }
});

$binanceTx.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $binanceResults.val("No wallet?");
    return;
  }
  if (core.supportsBinance(wallet)) {
    const res = await wallet.binanceSignTx({
      addressNList: core.bip32ToAddressNList(`m/44'/714'/0'/0/0`),
      chain_id: "Binance-Chain-Nile",
      account_number: "24250",
      sequence: 31,
      tx: bnbTxJson,
    });
    $binanceResults.val(JSON.stringify(res));
  } else {
    const label = await wallet.getLabel();
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
  if (core.supportsRipple(wallet)) {
    const { addressNList } = wallet.rippleGetAccountPaths({ accountIdx: 0 })[0];
    const result = await wallet.rippleGetAddress({
      addressNList,
      showDisplay: true,
    });
    $rippleResults.val(result);
  } else {
    const label = await wallet.getLabel();
    $rippleResults.val(label + " does not support Ripple");
  }
});

$rippleTx.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ethResults.val("No wallet?");
    return;
  }
  if (core.supportsRipple(wallet)) {
    const res = await wallet.rippleSignTx({
      addressNList: core.bip32ToAddressNList(`m/44'/144'/0'/0/0`),
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
    const label = await wallet.getLabel();
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
  if (core.supportsEos(wallet)) {
    const { addressNList } = wallet.eosGetAccountPaths({ accountIdx: 0 })[0];
    let result = await wallet.eosGetPublicKey({
      addressNList,
      showDisplay: false,
    });
    result = await wallet.eosGetPublicKey({
      addressNList,
      showDisplay: true,
      kind: 0,
    });
    $eosResults.val(result);
  } else {
    const label = await wallet.getLabel();
    $eosResults.val(label + " does not support Eos");
  }
});

$eosTx.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ethResults.val("No wallet?");
    return;
  }
  if (core.supportsEos(wallet)) {
    const unsigned_main = {
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

    const chainid_main = "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906";
    const res = await wallet.eosSignTx({
      addressNList: core.bip32ToAddressNList("m/44'/194'/0'/0/0"),
      chain_id: chainid_main,
      tx: unsigned_main,
    });

    console.info(res);
    console.info("sigV = %d", res.signatureV);
    console.info("sigR = %s", core.toHexString(res.signatureR));
    console.info("sigS = %s", core.toHexString(res.signatureS));
    console.info("hash = %s", core.toHexString(res.hash));
    console.info("EosFormatSig = %s", res.eosFormSig);
    console.info(
      "EosFormReSig = SIG_K1_Jxa7NRL1hj4Q9wqufaSZa7oAXQQnRxSuAeFSwx6EzHnzPVeB5y6qQge16WCYa3Xod1mDWZv3MnEEPFeK3bEf3iN6es1iVy"
    );

    $eosResults.val(res.eosFormSig);
  } else {
    const label = await wallet.getLabel();
    $eosResults.val(label + " does not support Eos");
  }
});

/*
 * Fio
 */
const $fioAddr = $("#fioAddr");
const $fioTx = $("#fioTx");
const $fioResults = $("#fioResults");

$fioAddr.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ethResults.val("No wallet?");
    return;
  }
  if (core.supportsFio(wallet)) {
    const { addressNList } = wallet.fioGetAccountPaths({ accountIdx: 0 })[0];
    let result = await wallet.fioGetPublicKey({
      addressNList,
      showDisplay: false,
      kind: 0,
    });
    result = await wallet.fioGetPublicKey({
      addressNList,
      showDisplay: true,
      kind: 0,
      address: result,
    });
    $fioResults.val(result);
  } else {
    const label = await wallet.getLabel();
    $fioResults.val(label + " does not support ");
  }
});

$fioTx.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ethResults.val("No wallet?");
    return;
  }
  if (core.supportsFio(wallet)) {
    const unsigned_main = {
      expiration: "2020-04-30T22:00:00.000",
      ref_block_num: 54661,
      ref_block_prefix: 2118672142,
      max_net_usage_words: 0,
      max_cpu_usage_ms: 0,
      delay_sec: 0,
      context_free_actions: [],
      actions: [],
    };

    const chainid_main = "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906";
    const res = await wallet.fioSignTx({
      addressNList: core.bip32ToAddressNList("m/44'/194'/0'/0/0"),
      chain_id: chainid_main,
      tx: unsigned_main,
    });

    console.info(res);
    console.info("signature = %d", res.signature);
    console.info("serialized = %s", core.toHexString(res.serialized));

    $eosResults.val(res.fioFormSig);
  } else {
    const label = await wallet.getLabel();
    $fioResults.val(label + " does not support Fio");
  }
});

/*
 * Cosmos
 */
const $cosmosAddr = $("#cosmosAddr");
const $cosmosTx = $("#cosmosTx");
const $cosmosDelegate = $("#cosmosDelegate");
const $cosmosUndelegate = $("#cosmosUndelegate");
const $cosmosRedelegate = $("#cosmosRedelegate");
const $cosmosRewards = $("#cosmosRewards");
const $cosmosIBCTransfer = $("#cosmosIBCTransfer");

const $cosmosResults = $("#cosmosResults");

$cosmosAddr.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $cosmosResults.val("No wallet?");
    return;
  }
  if (core.supportsCosmos(wallet)) {
    const { addressNList } = wallet.cosmosGetAccountPaths({ accountIdx: 0 })[0];
    const result = await wallet.cosmosGetAddress({
      addressNList,
      showDisplay: false,
    });
    await wallet.cosmosGetAddress({
      addressNList,
      showDisplay: true,
    });
    $cosmosResults.val(result);
  } else {
    const label = await wallet.getLabel();
    $cosmosResults.val(label + " does not support Cosmos");
  }
});

$cosmosTx.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $cosmosResults.val("No wallet?");
    return;
  }
  if (core.supportsCosmos(wallet)) {
    const unsigned: core.Cosmos.StdTx = cosmosTransferTx;

    const res = await wallet.cosmosSignTx({
      addressNList: core.bip32ToAddressNList(`m/44'/118'/0'/0/0`),
      chain_id: "cosmoshub-4",
      account_number: "16359",
      sequence: "17",
      tx: unsigned,
    });
    $cosmosResults.val(JSON.stringify(res));
  } else {
    const label = await wallet.getLabel();
    $cosmosResults.val(label + " does not support Cosmos");
  }
});

$cosmosDelegate.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $cosmosResults.val("No wallet?");
    return;
  }
  if (core.supportsCosmos(wallet)) {
    const unsigned: core.Cosmos.StdTx = cosmosDelegateTx;

    const res = await wallet.cosmosSignTx({
      addressNList: core.bip32ToAddressNList(`m/44'/118'/0'/0/0`),
      chain_id: "cosmoshub-4",
      account_number: "16359",
      sequence: "18",
      tx: unsigned,
    });
    $cosmosResults.val(JSON.stringify(res));
  } else {
    const label = await wallet.getLabel();
    $cosmosResults.val(label + " does not support Cosmos");
  }
});

$cosmosUndelegate.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $cosmosResults.val("No wallet?");
    return;
  }
  if (core.supportsCosmos(wallet)) {
    const unsigned: core.Cosmos.StdTx = cosmosUndelegateTx;

    const res = await wallet.cosmosSignTx({
      addressNList: core.bip32ToAddressNList(`m/44'/118'/0'/0/0`),
      chain_id: "cosmoshub-4",
      account_number: "16359",
      sequence: "20",
      tx: unsigned,
    });
    $cosmosResults.val(JSON.stringify(res));
  } else {
    const label = await wallet.getLabel();
    $cosmosResults.val(label + " does not support Cosmos");
  }
});

$cosmosRedelegate.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $cosmosResults.val("No wallet?");
    return;
  }
  if (core.supportsCosmos(wallet)) {
    const unsigned: core.Cosmos.StdTx = cosmosRedelegateTx;

    const res = await wallet.cosmosSignTx({
      addressNList: core.bip32ToAddressNList(`m/44'/118'/0'/0/0`),
      chain_id: "cosmoshub-4",
      account_number: "16359",
      sequence: "19",
      tx: unsigned,
    });
    $cosmosResults.val(JSON.stringify(res));
  } else {
    const label = await wallet.getLabel();
    $cosmosResults.val(label + " does not support Cosmos");
  }
});

$cosmosRewards.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $cosmosResults.val("No wallet?");
    return;
  }
  if (core.supportsCosmos(wallet)) {
    const unsigned: core.Cosmos.StdTx = cosmosRewardsTx;

    const res = await wallet.cosmosSignTx({
      addressNList: core.bip32ToAddressNList(`m/44'/118'/0'/0/0`),
      chain_id: "cosmoshub-4",
      account_number: "16359",
      sequence: "19",
      tx: unsigned,
    });
    $cosmosResults.val(JSON.stringify(res));
  } else {
    const label = await wallet.getLabel();
    $cosmosResults.val(label + " does not support Cosmos");
  }
});

$cosmosIBCTransfer.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $cosmosResults.val("No wallet?");
    return;
  }
  if (core.supportsCosmos(wallet)) {
    const unsigned: core.Cosmos.StdTx = cosmosIBCTransferTx;

    const res = await wallet.cosmosSignTx({
      addressNList: core.bip32ToAddressNList(`m/44'/118'/0'/0/0`),
      chain_id: "cosmoshub-4",
      account_number: "16359",
      sequence: "27",
      tx: unsigned,
    });
    $cosmosResults.val(JSON.stringify(res));
  } else {
    const label = await wallet.getLabel();
    $cosmosResults.val(label + " does not support Cosmos");
  }
});

/*
 * THORChain
 */
const $thorchainAddr = $("#thorchainAddr");
const $thorchainTx = $("#thorchainTx");
const $thorchainNativeResults = $("#thorchainNativeResults");
const $thorchainSignSwap = $("#thorchainSignSwap");
const $thorchainSourceChain = $("#thorchainSourceChain");
const $thorchainDestChain = $("#thorchainDestChain");
const $thorchainDestAddress = $("#thorchainDestAddress");
const $thorchainAmount = $("#thorchainAmount");
const $thorchainSwapResults = $("#thorchainSwapResults");

const $thorchainSignAddLiquidity = $("#thorchainSignAddLiquidity");
const $thorchainLiquidityAsset = $("#thorchainLiquidityAsset");
const $thorchainLiquidityAmount = $("#thorchainLiquidityAmount");
const $thorchainLiquidityPoolAddress = $("#thorchainLiquidityPoolAddress");
const $thorchainAddLiquidityResults = $("#thorchainAddLiquidityResults");

$thorchainAddr.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $thorchainNativeResults.val("No wallet?");
    return;
  }
  if (core.supportsThorchain(wallet)) {
    const { addressNList } = wallet.thorchainGetAccountPaths({ accountIdx: 0 })[0];
    const result = await wallet.thorchainGetAddress({
      addressNList,
      showDisplay: false,
    });
    await wallet.thorchainGetAddress({
      addressNList,
      showDisplay: true,
    });
    $thorchainNativeResults.val(result);
  } else {
    const label = await wallet.getLabel();
    $thorchainNativeResults.val(label + " does not support THORChain");
  }
});

$thorchainTx.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $thorchainNativeResults.val("No wallet?");
    return;
  }
  if (core.supportsThorchain(wallet)) {
    const res = await wallet.thorchainSignTx({
      addressNList: core.bip32ToAddressNList(`m/44'/931'/0'/0/0`),
      chain_id: "thorchain",
      account_number: "24250",
      sequence: "3",
      tx: thorchainUnsignedTx,
    });
    $thorchainNativeResults.val(JSON.stringify(res));
  } else {
    const label = await wallet.getLabel();
    $thorchainNativeResults.val(label + " does not support THORChain");
  }
});

$thorchainSignSwap.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $thorchainSwapResults.val("No wallet?");
    return;
  }
  if (!$thorchainDestAddress.val().match(/^[a-z0-9]+$/i) && $thorchainDestAddress.val() != "") {
    console.info($thorchainDestAddress.val());
    $thorchainSwapResults.val("Invalid destination address");
    return;
  }
  if (!$thorchainAmount.val().match(/^\d*\.?\d*$/) && $thorchainAmount.val() != "") {
    $thorchainSwapResults.val("Amount is not a number");
    return;
  }
  const routerContractAddress = "0x0000000000000000000000000000000000000000";
  const vaultAddress = "0x0000000000000000000000000000000000000000";
  let tx = {};
  const memo = `SWAP:${$thorchainDestChain.val()}:${$thorchainDestAddress.val()}:${$thorchainAmount.val()}`;
  switch ($thorchainSourceChain.val()) {
    case "BTC.BTC":
      tx = thorchainBitcoinBaseTx;

      if (core.supportsBTC(wallet)) {
        const txid = "b3002cd9c033f4f3c2ee5a374673d7698b13c7f3525c1ae49a00d2e28e8678ea";
        const hex =
          "010000000181f605ead676d8182975c16e7191c21d833972dd0ed50583ce4628254d28b6a3010000008a47304402207f3220930276204c83b1740bae1da18e5a3fa2acad34944ecdc3b361b419e3520220598381bdf8273126e11460a8c720afdbb679233123d2d4e94561f75e9b280ce30141045da61d81456b6d787d576dce817a2d61d7f8cb4623ee669cbe711b0bcff327a3797e3da53a2b4e3e210535076c087c8fb98aef60e42dfeea8388435fc99dca43ffffffff0250ec0e00000000001976a914f7b9e0239571434f0ccfdba6f772a6d23f2cfb1388ac10270000000000001976a9149c9d21f47382762df3ad81391ee0964b28dd951788ac00000000";

        const inputs = [
          {
            addressNList: [0x80000000 + 44, 0x80000000 + 0, 0x80000000 + 0, 0, 0],
            scriptType: core.BTCInputScriptType.SpendAddress,
            amount: String(10000),
            vout: 1,
            txid: txid,
            tx: btcTxJson,
            hex,
          },
        ];

        const outputs = [
          {
            address: "bc1q6m9u2qsu8mh8y7v8rr2ywavtj8g5arzlyhcej7",
            addressType: core.BTCOutputAddressType.Spend,
            opReturnData: Buffer.from(memo, "utf-8"),
            amount: String(0),
            isChange: false,
          },
        ];

        const res = await wallet.btcSignTx({
          coin: "Bitcoin",
          inputs: inputs,
          outputs: outputs,
          version: 1,
          locktime: 0,
          opReturnData: memo,
        });

        $thorchainSwapResults.val(res.serializedTx);
      } else {
        const label = await wallet.getLabel();
        $thorchainSwapResults.val(label + " does not support BTC");
      }
      break;
    case "ETH.ETH":
      if (core.supportsETH(wallet)) {
        const web3 = new Web3();
        console.info(thorchainRouterAbi[0]);
        const routerContract = new web3.eth.Contract(thorchainRouterAbi, routerContractAddress);
        tx = thorchainEthereumBaseTx;
        tx["addressNList"] = core.bip32ToAddressNList("m/44'/60'/0'/0/0");
        tx["data"] = routerContract.methods
          .deposit(vaultAddress, "0x0000000000000000000000000000000000000000", 0, memo)
          .encodeABI();
        const res = await wallet.ethSignTx(tx as any);
        $thorchainSwapResults.val(JSON.stringify(res));
      } else {
        const label = await wallet.getLabel();
        $thorchainSwapResults.val(label + " does not support ETH");
      }
      break;
    case "BNB.BNB":
      if (core.supportsBinance(wallet)) {
        tx = thorchainBinanceBaseTx;
        tx["memo"] = memo;
        console.info(tx);
        const res = await wallet.binanceSignTx({
          addressNList: core.bip32ToAddressNList(`m/44'/714'/0'/0/0`),
          chain_id: "Binance-Chain-Nile",
          account_number: "24250",
          sequence: 31,
          tx: tx as any,
        });
        $thorchainSwapResults.val(JSON.stringify(res));
      } else {
        const label = await wallet.getLabel();
        $thorchainSwapResults.val(label + " does not support Cosmos");
      }
      break;
    case "BNB.RUNE-B1A":
      if (core.supportsBinance(wallet)) {
        tx = thorchainNativeRuneBaseTx;
        tx["memo"] = memo;
        console.info(tx);
        const res = await wallet.binanceSignTx({
          addressNList: core.bip32ToAddressNList(`m/44'/714'/0'/0/0`),
          chain_id: "Binance-Chain-Nile",
          account_number: "24250",
          sequence: 31,
          tx: tx as any,
        });
        $thorchainSwapResults.val(JSON.stringify(res));
      } else {
        const label = await wallet.getLabel();
        $thorchainSwapResults.val(label + " does not support Cosmos");
      }
      break;
    case "THOR.RUNE":
      if (core.supportsThorchain(wallet)) {
        tx = thorchainUnsignedTx;
        tx["memo"] = memo;
        console.info(tx);
        const res = await wallet.thorchainSignTx({
          addressNList: core.bip32ToAddressNList(`m/44'/931'/0'/0/0`),
          chain_id: "thorchain",
          account_number: "24250",
          sequence: "3",
          tx: tx as any,
        });
        $thorchainSwapResults.val(JSON.stringify(res));
      } else {
        const label = await wallet.getLabel();
        $thorchainSwapResults.val(label + " does not support Cosmos");
      }
      break;
    case "ETH.USDT-0xdac17f958d2ee523a2206206994597c13d831ec7":
      if (core.supportsETH(wallet)) {
        tx = thorchainEthereumBaseTx;
        tx["addressNList"] = core.bip32ToAddressNList("m/44'/60'/0'/0/0");
        tx["data"] = "0x";
        const res = await wallet.ethSignTx(tx as any);
        $thorchainSwapResults.val(JSON.stringify(res));
      } else {
        const label = await wallet.getLabel();
        $ethResults.val(label + " does not support ETH");
      }
      break;
    default:
      console.info("Base coin is Unknown.");
      console.info("val:", $thorchainSourceChain.val());
      $thorchainSwapResults.val("Invalid source chain");
      return;
  }
  // $thorchainSwapResults.val(memo);
  //let res = await wallet.thorchainSignTx();
});

$thorchainSignAddLiquidity.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $thorchainAddLiquidityResults.val("No wallet?");
    return;
  }
  if (!$thorchainDestAddress.val().match(/^[a-z0-9]+$/i) && $thorchainDestAddress.val() != "") {
    console.info($thorchainDestAddress.val());
    $thorchainAddLiquidityResults.val("Invalid destination address");
    return;
  }
  if (!$thorchainAmount.val().match(/^\d*\.?\d*$/) && $thorchainAmount.val() != "") {
    $thorchainAddLiquidityResults.val("Amount is not a number");
    return;
  }
  const routerContractAddress = "0x0000000000000000000000000000000000000000";
  const vaultAddress = "0x0000000000000000000000000000000000000000";
  let tx = {};
  const memo = `ADD:${$thorchainLiquidityAsset.val()}:${$thorchainLiquidityPoolAddress.val()}}`;
  switch ($thorchainLiquidityAsset.val()) {
    case "BTC.BTC":
      tx = thorchainBitcoinBaseTx;

      if (core.supportsBTC(wallet)) {
        const txid = "b3002cd9c033f4f3c2ee5a374673d7698b13c7f3525c1ae49a00d2e28e8678ea";
        const hex =
          "010000000181f605ead676d8182975c16e7191c21d833972dd0ed50583ce4628254d28b6a3010000008a47304402207f3220930276204c83b1740bae1da18e5a3fa2acad34944ecdc3b361b419e3520220598381bdf8273126e11460a8c720afdbb679233123d2d4e94561f75e9b280ce30141045da61d81456b6d787d576dce817a2d61d7f8cb4623ee669cbe711b0bcff327a3797e3da53a2b4e3e210535076c087c8fb98aef60e42dfeea8388435fc99dca43ffffffff0250ec0e00000000001976a914f7b9e0239571434f0ccfdba6f772a6d23f2cfb1388ac10270000000000001976a9149c9d21f47382762df3ad81391ee0964b28dd951788ac00000000";

        const inputs = [
          {
            addressNList: [0x80000000 + 44, 0x80000000 + 0, 0x80000000 + 0, 0, 0],
            scriptType: core.BTCInputScriptType.SpendAddress,
            amount: String(10000),
            vout: 1,
            txid: txid,
            tx: btcTxJson,
            hex,
          },
        ];

        const outputs = [
          {
            addressType: core.BTCOutputAddressType.Spend,
            opReturnData: Buffer.from(memo, "utf-8"),
            amount: $thorchainLiquidityAmount.val(),
            isChange: false,
          },
        ];

        const res = await wallet.btcSignTx({
          coin: "Bitcoin",
          inputs: inputs,
          outputs: outputs,
          version: 1,
          locktime: 0,
        });

        $thorchainAddLiquidityResults.val(res.serializedTx);
      } else {
        const label = await wallet.getLabel();
        $thorchainAddLiquidityResults.val(label + " does not support BTC");
      }
      break;
    case "ETH.ETH":
      if (core.supportsETH(wallet)) {
        const web3 = new Web3();
        console.info(thorchainRouterAbi[0]);
        const routerContract = new web3.eth.Contract(thorchainRouterAbi, routerContractAddress);
        tx = thorchainEthereumBaseTx;
        tx["value"] = "0x" + $thorchainLiquidityAmount.val().toString(16);
        tx["addressNList"] = core.bip32ToAddressNList("m/44'/60'/0'/0/0");
        tx["data"] = routerContract.methods
          .deposit(vaultAddress, "0x0000000000000000000000000000000000000000", 0, memo)
          .encodeABI();
        console.info(tx);
        const res = await wallet.ethSignTx(tx as any);
        $thorchainAddLiquidityResults.val(JSON.stringify(res));
      } else {
        const label = await wallet.getLabel();
        $thorchainAddLiquidityResults.val(label + " does not support ETH");
      }
      break;
    case "BNB.BNB":
      if (core.supportsBinance(wallet)) {
        tx = thorchainBinanceBaseTx;
        tx["memo"] = memo;
        tx["msgs"]["outputs"][0] = {
          address: $thorchainLiquidityPoolAddress.val(),
          coins: [{ amount: $thorchainLiquidityAmount.val(), denom: "BNB" }],
        };
        const res = await wallet.binanceSignTx({
          addressNList: core.bip32ToAddressNList(`m/44'/714'/0'/0/0`),
          chain_id: "Binance-Chain-Nile",
          account_number: "24250",
          sequence: 31,
          tx: tx as any,
        });
        $thorchainAddLiquidityResults.val(JSON.stringify(res));
      } else {
        const label = await wallet.getLabel();
        $thorchainAddLiquidityResults.val(label + " does not support Cosmos");
      }
      break;
    case "BNB.RUNE-B1A":
      if (core.supportsBinance(wallet)) {
        tx = thorchainNativeRuneBaseTx;
        tx["memo"] = memo;
        tx["msgs"]["outputs"][0] = {
          address: $thorchainLiquidityPoolAddress.val(),
          coins: [{ amount: $thorchainLiquidityAmount.val(), denom: "BNB" }],
        };
        const res = await wallet.binanceSignTx({
          addressNList: core.bip32ToAddressNList(`m/44'/714'/0'/0/0`),
          chain_id: "Binance-Chain-Nile",
          account_number: "24250",
          sequence: 31,
          tx: tx as any,
        });
        $thorchainAddLiquidityResults.val(JSON.stringify(res));
      } else {
        const label = await wallet.getLabel();
        $thorchainAddLiquidityResults.val(label + " does not support Cosmos");
      }
      break;
    case "THOR.RUNE":
      if (core.supportsThorchain(wallet)) {
        tx = thorchainUnsignedTx;
        tx["memo"] = memo;
        tx["msgs"]["outputs"][0] = {
          address: $thorchainLiquidityPoolAddress.val(),
          coins: [{ amount: $thorchainLiquidityAmount.val(), denom: "RUNE" }],
        };
        console.info(tx);
        const res = await wallet.thorchainSignTx({
          addressNList: core.bip32ToAddressNList(`m/44'/931'/0'/0/0`),
          chain_id: "thorchain",
          account_number: "24250",
          sequence: "3",
          tx: tx as any,
        });
        $thorchainAddLiquidityResults.val(JSON.stringify(res));
      } else {
        const label = await wallet.getLabel();
        $thorchainAddLiquidityResults.val(label + " does not support Cosmos");
      }
      break;
    case "ETH.USDT-0xdac17f958d2ee523a2206206994597c13d831ec7":
      if (core.supportsETH(wallet)) {
        tx = thorchainEthereumBaseTx;
        tx["addressNList"] = core.bip32ToAddressNList("m/44'/60'/0'/0/0");
        tx["data"] = "0x";
        tx["to"] = $thorchainLiquidityPoolAddress.val();
        tx["value"] = $thorchainLiquidityAmount.val();
        const res = await wallet.ethSignTx(tx as any);
        $thorchainAddLiquidityResults.val(JSON.stringify(res));
      } else {
        const label = await wallet.getLabel();
        $ethResults.val(label + " does not support ETH");
      }
      break;
    default:
      console.info("Base coin is Unknown.");
      console.info("val:", $thorchainSourceChain.val());
      $thorchainAddLiquidityResults.val("Invalid source chain");
      return;
  }
});

/*
 * Osmosis
 */
const $osmosisAddress = $("#osmosisAddress");
const $osmosisAddressResults = $("#osmosisAddressResults");
const $osmosisSignTxAddress = $("#osmosisSignTxAddress");
const $osmosisSignTxAmount = $("#osmosisSignTxAmount");
const $osmosisSignTxResults = $("#osmosisSignTxResults");
const $osmosisSignTx = $("#osmosisSignTx");
const $osmosisDelegateDelegatorAddress = $("#osmosisDelegateDelegatorAddress");
const $osmosisDelegateValidatorAddress = $("#osmosisDelegateValidatorAddress");
const $osmosisDelegateAmount = $("#osmosisDelegateAmount");
const $osmosisDelegate = $("#osmosisDelegate");
const $osmosisDelegateResults = $("#osmosisDelegateResults");
const $osmosisUndelegateDelegatorAddress = $("#osmosisDelegateDelegatorAddress");
const $osmosisUndelegateValidatorAddress = $("#osmosisDelegateValidatorAddress");
const $osmosisUndelegateAmount = $("#osmosisDelegateAmount");
const $osmosisUndelegate = $("#osmosisDelegate");
const $osmosisUndelegateResults = $("#osmosisUndelegateResults");

$osmosisAddress.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $osmosisAddressResults.val("No wallet?");
    return;
  }
  if (core.supportsOsmosis(wallet)) {
    const { addressNList } = wallet.osmosisGetAccountPaths({ accountIdx: 0 })[0];
    const result = await wallet.osmosisGetAddress({
      addressNList,
      showDisplay: false,
    });
    await wallet.osmosisGetAddress({
      addressNList,
      showDisplay: true,
    });
    $osmosisAddressResults.val(result);
  } else {
    const label = await wallet.getLabel();
    $osmosisAddressResults.val(label + " does not support Osmosis");
  }
});

$osmosisSignTx.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $osmosisSignTxResults.val("No wallet?");
    return;
  }
  if (core.supportsOsmosis(wallet)) {
    const res = await wallet.osmosisSignTx({
      tx: {
        chain_id: "osmosis",
        account_number: "75815",
        sequence: "2",
        msg: [
          {
            type: "cosmos-sdk/MsgSend",
            value: {
              from_address: "osmo1a7xqkxa4wyjfllme9u3yztgsz363dalz3lxtj6",
              to_address: $osmosisSignTxAddress.val(),
              amount: [
                {
                  denom: "uosmo",
                  amount: $osmosisSignTxAmount.val(),
                },
              ],
            },
          },
        ],
        fee: {
          amount: [
            {
              denom: "uosmo",
              amount: "2800",
            },
          ],
          gas: "80000",
        },
        signatures: [],
        memo: "hello world",
        timeout_height: "0",
      },
      addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
      chain_id: "osmosis-1",
      account_number: "16354",
      sequence: "5",
    });
    $osmosisSignTxResults.val(JSON.stringify(res));
  } else {
    const label = await wallet.getLabel();
    $osmosisSignTxResults.val(label + " does not support Osmosis");
  }
});

$osmosisDelegate.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $osmosisDelegateResults.val("No wallet?");
    return;
  }
  if (core.supportsOsmosis(wallet)) {
    const res = await wallet.osmosisSignTx({
      tx: {
        fee: {
          amount: [
            {
              amount: "2800",
              denom: "uosmo",
            },
          ],
          gas: "290000",
        },
        memo: "",
        msg: [
          {
            type: "cosmos-sdk/MsgDelegate",
            value: {
              delegator_address: $osmosisDelegateDelegatorAddress.val(),
              validator_address: $osmosisDelegateValidatorAddress.val(),
              amount: {
                denom: "uosmo",
                amount: $osmosisDelegateAmount.val(),
              },
            },
          },
        ],
        signatures: [],
      },
      addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
      chain_id: "osmosis-1",
      account_number: "16354",
      sequence: "5",
    });
    $osmosisDelegateResults.val(JSON.stringify(res));
  } else {
    const label = await wallet.getLabel();
    $osmosisDelegateResults.val(label + " does not support Osmosis");
  }
});

$osmosisUndelegate.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $osmosisUndelegateResults.val("No wallet?");
    return;
  }
  if (core.supportsOsmosis(wallet)) {
    const res = await wallet.osmosisSignTx({
      tx: {
        fee: {
          amount: [
            {
              denom: "uosmo",
              amount: "0",
            },
          ],
          gas: "250000",
        },
        msg: [
          {
            type: "cosmos-sdk/MsgUndelegate",
            value: {
              delegator_address: $osmosisUndelegateDelegatorAddress.val(),
              validator_address: $osmosisUndelegateValidatorAddress.val(),
              amount: {
                denom: "uosmo",
                amount: $osmosisUndelegateAmount.val(),
              },
            },
          },
        ],
        signatures: [],
        memo: "",
        timeout_height: "0",
      },
      addressNList: core.bip32ToAddressNList("m/44'/118'/0'/0/0"),
      chain_id: "osmosis-1",
      account_number: "16354",
      sequence: "5",
    });
    $osmosisUndelegateResults.val(JSON.stringify(res));
  } else {
    const label = await wallet.getLabel();
    $osmosisUndelegateResults.val(label + " does not support Osmosis");
  }
});

/*
      Ethereum
        * segwit: false
        * mutltisig: false
        * Bech32: false

*/

let ethEIP1559Selected = false;

const ethTx = {
  addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
  nonce: "0x01",
  gasPrice: "0x1dcd65000",
  gasLimit: "0x5622",
  value: "0x2c68af0bb14000",
  to: "0x12eC06288EDD7Ae2CC41A843fE089237fC7354F0",
  chainId: 1,
  data: "",
};

const ethTx1559 = {
  addressNList: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
  nonce: "0x0",
  gasLimit: "0x5ac3",
  maxFeePerGas: "0x16854be509",
  maxPriorityFeePerGas: "0x540ae480",
  value: "0x1550f7dca70000", // 0.006 eth
  to: "0xfc0cc6e85dff3d75e3985e0cb83b090cfd498dd1",
  chainId: 1,
  data: "",
};

$ethAddr.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ethResults.val("No wallet?");
    return;
  }

  if (core.supportsETH(wallet)) {
    const { hardenedPath, relPath } = wallet.ethGetAccountPaths({
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
    const label = await wallet.getLabel();
    $ethResults.val(label + " does not support ETH");
  }
});

$ethTx.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ethResults.val("No wallet?");
    return;
  }
  if (core.supportsETH(wallet)) {
    const res = ethEIP1559Selected ? await wallet.ethSignTx(ethTx1559) : await wallet.ethSignTx(ethTx);
    $ethResults.val(JSON.stringify(res));
  } else {
    const label = await wallet.getLabel();
    $ethResults.val(label + " does not support ETH");
  }
});

$ethSign.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ethResults.val("No wallet?");
    return;
  }
  if (core.supportsETH(wallet)) {
    const { hardenedPath: hard, relPath: rel } = wallet.ethGetAccountPaths({
      coin: "Ethereum",
      accountIdx: 0,
    })[0];
    const result = await wallet.ethSignMessage({
      addressNList: hard.concat(rel),
      message: "Hello World",
    });
    $ethResults.val(result.address + ", " + result.signature);
  } else {
    const label = await wallet.getLabel();
    $ethResults.val(label + " does not support ETH");
  }
});

$ethSend.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ethResults.val("No wallet?");
    return;
  }
  if (core.supportsETH(wallet)) {
    const result = ethEIP1559Selected
      ? await wallet.ethSendTx(ethTx1559 as core.ETHSignTx)
      : await wallet.ethSendTx(ethTx as core.ETHSignTx);
    console.info("Result: ", result);
    $ethResults.val(result.hash);
  } else {
    const label = await wallet.getLabel();
    $ethResults.val(label + " does not support ETH");
  }
});

$ethVerify.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ethResults.val("No wallet?");
    return;
  }
  if (core.supportsETH(wallet)) {
    const result = await wallet.ethVerifyMessage({
      address: "0x2068dD92B6690255553141Dfcf00dF308281f763",
      message: "Hello World",
      signature:
        "61f1dda82e9c3800e960894396c9ce8164fd1526fccb136c71b88442405f7d09721725629915d10bc7cecfca2818fe76bc5816ed96a1b0cebee9b03b052980131b",
    });
    $ethResults.val(result ? "✅" : "❌");
  } else {
    const label = await wallet.getLabel();
    $ethResults.val(label + " does not support ETH");
  }
});

$ethEIP1559.on("click", async () => {
  if (!ethEIP1559Selected) {
    $ethEIP1559.attr("class", "button");
  } else {
    $ethEIP1559.attr("class", "button-outline");
  }
  ethEIP1559Selected = !ethEIP1559Selected;
});

/*
      ERC-20
        * segwit: false
        * mutltisig: false
        * Bech32: false

*/
const $erc20DynamicContainer = $("#erc20DynamicContainer");

const $erc20Addr = $("#erc20Addr");
const $erc20Allowance = $("#erc20Allowance");
const $erc20Approve = $("#erc20Approve");
const $erc20BalanceOf = $("#erc20BalanceOf");
const $erc20TotalSupply = $("#erc20TotalSupply");
const $erc20Transfer = $("#erc20Transfer");
const $erc20TransferFrom = $("#erc20TransferFrom");

const $erc20Results = $("#erc20Results");
const $erc20Submit = $("#erc20Submit");

let erc20Selected: any;

function erc20SetSetSelected(selectedButton: any) {
  const erc20ButtonContentMap = [
    {
      button: $erc20Addr,
      content: "",
    },
    {
      button: $erc20Allowance,
      content:
        "\
      <input type='text' placeholder='Contract Address' id='erc20ContractAddress' />\
      <input type='text' placeholder='Owner Address' id='erc20OwnerAddress' />\
      <input type='text' placeholder='Spender Address' id='erc20SpenderAddress' />\
      ",
    },
    {
      button: $erc20Approve,
      content:
        "\
      <input type='text' placeholder='Contract Address' id='erc20ContractAddress' />\
      <input type='text' placeholder='Spender Address' id='erc20SpenderAddress' />\
      <input type='text' placeholder='Amount' id='erc20Amount' />\
      ",
    },
    {
      button: $erc20BalanceOf,
      content:
        "\
      <input type='text' placeholder='Contract Address' id='erc20ContractAddress' />\
      <input type='text' placeholder='Account Address' id='erc20AccountAddress' />\
      ",
    },
    {
      button: $erc20TotalSupply,
      content: "\
      <input type='text' placeholder='Contract Address' id='erc20ContractAddress' />\
      ",
    },
    {
      button: $erc20Transfer,
      content:
        "\
      <input type='text' placeholder='Contract Address' id='erc20ContractAddress' />\
      <input type='text' placeholder='Recipient Address' id='erc20RecipientAddress' />\
      <input type='text' placeholder='Amount' id='erc20Amount' />\
      ",
    },
    {
      button: $erc20TransferFrom,
      content:
        "\
      <input type='text' placeholder='Contract Address' id='erc20ContractAddress' />\
      <input type='text' placeholder='Sender Address' id='erc20SenderAddress' />\
      <input type='text' placeholder='Recipient Address' id='erc20RecipientAddress' />\
      <input type='text' placeholder='Amount' id='erc20Amount' />\
      ",
    },
  ];

  erc20ButtonContentMap
    .map((o) => o.button)
    .forEach((button) => {
      if (button == selectedButton) {
        button.attr("class", "button");
        $erc20DynamicContainer.empty();
        $erc20DynamicContainer.append(erc20ButtonContentMap.filter((o) => o.button == button)[0].content);
        erc20Selected = button;
      } else {
        button.attr("class", "button-outline");
      }
    });
}

$erc20Addr.on("click", async (e) => {
  e.preventDefault();
  erc20SetSetSelected($erc20Addr);
});

$erc20TotalSupply.on("click", async (e) => {
  e.preventDefault();
  erc20SetSetSelected($erc20TotalSupply);
});

$erc20BalanceOf.on("click", async (e) => {
  e.preventDefault();
  erc20SetSetSelected($erc20BalanceOf);
});

$erc20Allowance.on("click", async (e) => {
  e.preventDefault();
  erc20SetSetSelected($erc20Allowance);
});

$erc20Transfer.on("click", async (e) => {
  e.preventDefault();
  erc20SetSetSelected($erc20Transfer);
});

$erc20Approve.on("click", async (e) => {
  e.preventDefault();
  erc20SetSetSelected($erc20Approve);
});

$erc20TransferFrom.on("click", async (e) => {
  e.preventDefault();
  erc20SetSetSelected($erc20TransferFrom);
});

$erc20Submit.on("click", async () => {
  if (!wallet) {
    $erc20Results.val("No wallet?");
    return;
  }

  let result: any;
  let data: any;

  if (core.supportsETH(wallet)) {
    const { hardenedPath, relPath } = wallet.ethGetAccountPaths({
      coin: "Ethereum",
      accountIdx: 0,
    })[0];

    switch (erc20Selected) {
      case $erc20Addr:
        result = await wallet.ethGetAddress({
          addressNList: hardenedPath.concat(relPath),
          showDisplay: false,
        });
        result = await wallet.ethGetAddress({
          addressNList: hardenedPath.concat(relPath),
          showDisplay: true,
          address: result,
        });
        break;
      case $erc20Allowance:
        data =
          "0x" +
          "dd62ed3e" + // ERC-20 contract allowance function identifier
          $("#erc20OwnerAddress").val().replace("0x", "").padStart(64, "0") +
          $("#erc20SpenderAddress").val().replace("0x", "").padStart(64, "0");

        break;
      case $erc20Approve:
        data =
          "0x" +
          "095ea7b3" + // ERC-20 contract approve function identifier
          $("#erc20SpenderAddress").val().replace("0x", "").padStart(64, "0") +
          parseInt($("#erc20Amount").val(), 10).toString(16).padStart(64, "0");
        break;
      case $erc20BalanceOf:
        data =
          "0x" +
          "70a08231" + // ERC-20 contract balanceOf function identifier
          $("#erc20AccountAddress").val().replace("0x", "").padStart(64, "0");
        break;
      case $erc20TotalSupply:
        data = "0x" + "18160ddd"; // ERC-20 contract totalSupply function identifier

        break;
      case $erc20Transfer:
        data =
          "0x" +
          "a9059cbb" + // ERC-20 contract transfer function identifier
          $("#erc20RecipientAddress").val().replace("0x", "").padStart(64, "0") +
          parseInt($("#erc20Amount").val(), 10).toString(16).padStart(64, "0");
        break;
      case $erc20TransferFrom:
        data =
          "0x" +
          "23b872dd" + // ERC-20 contract transferFrom function identifier
          $("#erc20SenderAddress").val().replace("0x", "").padStart(64, "0") +
          $("#erc20RecipientAddress").val().replace("0x", "").padStart(64, "0") +
          parseInt($("#erc20Amount").val(), 10).toString(16).padStart(64, "0");
        break;
      default:
        console.info("oops", erc20Selected);
        return;
    }
    if (erc20Selected != $erc20Addr) {
      result = await wallet.ethSignTx({
        addressNList: hardenedPath.concat(relPath),
        nonce: "0x0",
        gasPrice: "0x5FB9ACA00",
        gasLimit: "0x186A0",
        value: "0x00",
        to: $("#erc20ContractAddress").val(),
        chainId: 1,
        data: data,
      });
    }
  } else {
    const label = await wallet.getLabel();
    $erc20Results.val(label + " does not support ETH");
  }

  console.info(result);
  $erc20Results.val(JSON.stringify(result, null, 4));
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
  if (core.supportsBTC(wallet)) {
    //coin 0 (mainnet bitcoin)
    //path 0
    const res = await wallet.btcGetAddress({
      addressNList: [0x80000000 + 44, 0x80000000 + 0, 0x80000000 + 0, 0, 0],
      coin: "Bitcoin",
      scriptType: core.BTCInputScriptType.SpendAddress,
      showDisplay: true,
    });
    $btcResults.val(res);
  } else {
    const label = await wallet.getLabel();
    $btcResults.val(label + " does not support BTC");
  }
});

$btcTx.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $btcResults.val("No wallet?");
    return;
  }

  if (core.supportsBTC(wallet)) {
    const txid = "b3002cd9c033f4f3c2ee5a374673d7698b13c7f3525c1ae49a00d2e28e8678ea";
    const hex =
      "010000000181f605ead676d8182975c16e7191c21d833972dd0ed50583ce4628254d28b6a3010000008a47304402207f3220930276204c83b1740bae1da18e5a3fa2acad34944ecdc3b361b419e3520220598381bdf8273126e11460a8c720afdbb679233123d2d4e94561f75e9b280ce30141045da61d81456b6d787d576dce817a2d61d7f8cb4623ee669cbe711b0bcff327a3797e3da53a2b4e3e210535076c087c8fb98aef60e42dfeea8388435fc99dca43ffffffff0250ec0e00000000001976a914f7b9e0239571434f0ccfdba6f772a6d23f2cfb1388ac10270000000000001976a9149c9d21f47382762df3ad81391ee0964b28dd951788ac00000000";

    const inputs = [
      {
        addressNList: [0x80000000 + 44, 0x80000000 + 0, 0x80000000 + 0, 0, 0],
        scriptType: core.BTCInputScriptType.SpendAddress,
        amount: String(10000),
        vout: 1,
        txid: txid,
        tx: btcTxJson,
        hex,
      },
    ];

    const outputs = [
      {
        address: "1MJ2tj2ThBE62zXbBYA5ZaN3fdve5CPAz1",
        addressType: core.BTCOutputAddressType.Spend,
        scriptType: core.BTCOutputScriptType.PayToAddress,
        amount: String(10000 - 1000),
        isChange: false,
      },
    ];

    const res = await wallet.btcSignTx({
      coin: "Bitcoin",
      inputs: inputs,
      outputs: outputs,
      version: 1,
      locktime: 0,
    });

    $btcResults.val(res.serializedTx);
  } else {
    const label = await wallet.getLabel();
    $btcResults.val(label + " does not support BTC");
  }
});

$btcSign.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $btcResults.val("No wallet?");
    return;
  }
  if (core.supportsBTC(wallet)) {
    const res = await wallet.btcSignMessage({
      addressNList: core.bip32ToAddressNList("m/44'/0'/0'/0/0"),
      coin: "Bitcoin",
      scriptType: core.BTCInputScriptType.SpendAddress,
      message: "Hello World",
    });
    $btcResults.val(res.address + " " + res.signature);
  } else {
    const label = await wallet.getLabel();
    $btcResults.val(label + " does not support BTC");
  }
});

$btcVerify.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $btcResults.val("No wallet?");
    return;
  }
  if (core.supportsBTC(wallet)) {
    const res = await wallet.btcVerifyMessage({
      address: "1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM",
      coin: "Bitcoin",
      signature:
        "20a037c911044cd6c851b6508317d8892067b0b62074b2cf1c0df9abd4aa053a3c243ffdc37f64d7af2c857128eafc81947c380995596615e5dcc313a15f512cdd",
      message: "Hello World",
    });
    $btcResults.val(res ? "✅" : "❌");
  } else {
    const label = await wallet.getLabel();
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
const $ltcResults = $("#ltcResults");

const ltcBip44 = {
  scriptType: core.BTCInputScriptType.SpendAddress,
  addressNList: [0x80000000 + 44, 0x80000000 + 2, 0x80000000 + 0, 0, 0],
};

$ltcAddr.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ltcResults.val("No wallet?");
    return;
  }
  if (core.supportsBTC(wallet)) {
    const res = await wallet.btcGetAddress({
      addressNList: ltcBip44.addressNList,
      coin: "Litecoin",
      scriptType: ltcBip44.scriptType,
      showDisplay: true,
    });
    $ltcResults.val(res);
  } else {
    const label = await wallet.getLabel(); // should be LYXTv5RdsPYKC4qGmb6x6SuKoFMxUdSjLQ
    $ltcResults.val(label + " does not support Litecoin");
  }
});

$ltcTx.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ltcResults.val("No wallet?");
    return;
  }
  if (core.supportsBTC(wallet)) {
    const txid = "1de79c706f34c81bbefad49a9ff8d12b6ca86b77605a1998505e4f8792a5892d";
    const hex =
      "010000000196f5704ef948abb958f32ff216112d3283142baf50723833c378882c14a9adea010000006a47304402207c899ba5197a23b1f3cc4b3621abbc682b5142f3ae29af4b951952573f6c82a002203fd7f038aa8403d2c06fd32c237ab4e915939c25aafa7bcb06fb0ddd46afbfd3012103eddbce765b6d7ae1c91b779696e8b8f72ce444070f83beba2f823af76fd4dfebffffffff0290680a00000000001976a91491e975a0238fa1dfff703e50f062e2544a3e372088aca6791100000000001976a91415757f526dc67b52ae9f74918db532eebc39608688ac00000000";

    const inputs = [
      {
        addressNList: ltcBip44.addressNList,
        scriptType: core.BTCInputScriptType.SpendAddress,
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
        addressType: core.BTCOutputAddressType.Spend,
        scriptType: core.BTCOutputScriptType.PayToAddress,
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
    const label = await wallet.getLabel();
    $ltcResults.val(label + " does not support Litecoin");
  }
});

$ltcSign.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $ltcResults.val("No wallet?");
    return;
  }
  if (core.supportsBTC(wallet)) {
    const res = await wallet.btcSignMessage({
      addressNList: ltcBip44.addressNList,
      coin: "Litecoin",
      scriptType: core.BTCInputScriptType.SpendAddress,
      message: "Hello World",
    });
    $ltcResults.val(res.address + " " + res.signature);
    // Address: LYXTv5RdsPYKC4qGmb6x6SuKoFMxUdSjLQ
    // Signature: 1f835c7efaf953e059e7074afa954c5a8535be321f48e393e125e2a839d1721b495b935df1162c2b69f3e698167b75ab8bfd2c9c203f6070ff701ebca49653a056
  } else {
    const label = await wallet.getLabel();
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
  scriptType: core.BTCInputScriptType.SpendAddress,
  addressNList: [0x80000000 + 44, 0x80000000 + 3, 0x80000000 + 0],
};
$dogeAddr.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $dogeResults.val("No wallet?");
    return;
  }
  if (core.supportsBTC(wallet)) {
    const res = await wallet.btcGetAddress({
      addressNList: dogeBip44.addressNList.concat([0, 0]),
      coin: "Dogecoin",
      scriptType: dogeBip44.scriptType,
      showDisplay: true,
    });
    $dogeResults.val(res);
  } else {
    const label = await wallet.getLabel(); // should be DQTjL9vfXVbMfCGM49KWeYvvvNzRPaoiFp for alcohol abuse
    $dogeResults.val(label + " does not support DOGE");
  }
});

$dogeTx.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $dogeResults.val("No wallet?");
    return;
  }
  if (core.supportsBTC(wallet)) {
    const txid = "4ab8c81585bf61ddcba03f4b2f4958b3800d68b02874f4955e258775cb3e7068";
    const hex =
      "01000000048831c8a8c7f06e5f4ecccb789cc9de0fc843208797652ff9edf6edaa64d02789010000006a473044022070e25a73ceebaf5b3a35d5e4930ebba77957a2fe485b9dcbaf982a7c63d4baab02206e75dcc4258db29a2803d6a14112d3d81f93ec23f9b2a61bfe8102d764d7c6390121031b49bb2c43daac784377bcca83c41f781007626e6e8b66cda9f57fed11494359feffffff52a8a6ac8ea9b436069c160caae68b2eb0a5b713a7b838179833af5a339e48e9000000006a47304402206b3aa1a4656d4859b87512a5fb50c73f0f6e05d45fa027850a3e1eb4f927675402201fb1c52d85380727d28bea7a21d434bed2d57d3a120082c6c69d578b4f3da07c0121033034cf66b3b153a81713b3ddbcdffd92c34c46510353cf01b237fcfbcf1348bdfeffffff35f6938fd9d9077d913bd6cfc546cbadb17d4db6ccb67d87a1f89e562d6bed8e000000006b483045022100a0e8a73fc2358a206a73a78582fd7ebba2fb08487aca78aaa89cbf7f9805da0102207704f4f27ff6297b11acd74f8e3f28d924c4006ac0d37dd37bbdba1ef8f401ae0121038ac65cabea63b92d3aabd3f17591c23bbec73b87220a3f0325fe2de9e62107e3feffffff07cd534960ea57fdb4195d3de7dae1feb1e630a022c08baca2f2423f4d190a27010000006a47304402203c89ade05e93ee9cb9bfa0703be55a76abd40330108a5e5272bcd0c8338c35df022042d8cb34275e87df1b77f19e9dde5da553b98bca67c1c332a53392b32d55ba580121038291eee31aa046a00938dda548c0c948f57bf5dc6e534abbe0d5078a6ce083a0feffffff02b8adfa31000000001976a9146ef1cda5c24d47934853aeccce14163e3a18be1388ac02bd9348080000001976a914d3f096cbc84bd6daf7e7fe2700c32548ca2f23f188acadd31600";

    const inputs = [
      {
        addressNList: dogeBip44.addressNList.concat([0, 0]),
        scriptType: core.BTCInputScriptType.SpendAddress,
        amount: String(35577380098),
        vout: 1,
        txid: txid,
        segwit: false,
        tx: dogeTxJson,
        hex,
      },
    ];

    const outputs = [
      {
        address: "DMEHVGRsELY5zyYbfgta3pAhedKGeaDeJd",
        addressType: core.BTCOutputAddressType.Spend,
        scriptType: core.BTCOutputScriptType.PayToAddress,
        amount: String(35577380098),
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
    const label = await wallet.getLabel();
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
  scriptType: core.BTCInputScriptType.SpendAddress,
  addressNList: [0x80000000 + 44, 0x80000000 + 145, 0x80000000 + 0],
};

$bchAddr.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $bchResults.val("No wallet?");
    return;
  }
  if (core.supportsBTC(wallet)) {
    const res = await wallet.btcGetAddress({
      addressNList: bchBip44.addressNList.concat([0, 0]),
      coin: "BitcoinCash",
      scriptType: bchBip44.scriptType,
      showDisplay: true,
    });
    $bchResults.val(res);
  } else {
    const label = await wallet.getLabel(); // KK: bitcoincash:qzqxk2q6rhy3j9fnnc00m08g4n5dm827xv2dmtjzzp or Ledger: 1Ci1rvsLpZqvaMLSq7LiFj6mfnV4p3833E
    $bchResults.val(label + " does not support BCH");
  }
});

$bchTx.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $bchResults.val("No wallet?");
    return;
  }
  if (core.supportsBTC(wallet)) {
    const txid = "35ec5b47eea3b45efb062c6fabad43987a79b855dc42630b34f8d26d4a646a2e";
    const hex =
      "0100000002a90f75f5924be1fb8147885f6212fefeed3d192eb23a737265f01c822aa74be9000000006b48304502210092dbd26379c6a707b5974bf9ce242baf151a2cef95a5644f6bd4fa05bcbf433e0220125c3647fe473a7e9bf89cb092e1f5e2b26f10a33a12c23b2cfbf2bb1d72c6324121035942ab1589fb2f85c0b3e0c9a37b8ea3092ac749fcbc20733ed227322b5da9ecffffffffbaa5bc3a01a705c377b3ee88ae21ca70ee9d3694f05c466f420cc2bd1951afe5000000006b483045022100a79147c5cf806a2bb3bb6619113cc4bf9b522aaf529ea1b34a93b99bd33054020220019df030c623c9e782f23e755fa9259ec708427606cce8302d5a125e4147838a4121035942ab1589fb2f85c0b3e0c9a37b8ea3092ac749fcbc20733ed227322b5da9ecffffffff0188c7d200000000001976a914806b281a1dc91915339e1efdbce8ace8dd9d5e3388ac00000000";

    const inputs = [
      {
        addressNList: bchBip44.addressNList.concat([0, 0]),
        scriptType: core.BTCInputScriptType.SpendAddress,
        amount: String(13813640),
        vout: 0,
        txid: txid,
        segwit: false,
        hex,
      },
    ];

    const outputs = [
      {
        address: (await wallet.btcSupportsScriptType("BitcoinCash", core.BTCInputScriptType.CashAddr))
          ? "bitcoincash:qq5mg2xtp9y5pvvgy7m4k2af5a7s5suulueyywgvnf"
          : "14oWXZFPhgP9DA3ggPzhHpUUaikDSjAuMC",
        addressType: core.BTCOutputAddressType.Spend,
        scriptType: core.BTCOutputScriptType.PayToAddress,
        amount: String(13813640),
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
    const label = await wallet.getLabel();
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
  scriptType: core.BTCInputScriptType.SpendAddress,
  addressNList: [0x80000000 + 44, 0x80000000 + 5, 0x80000000 + 0],
};

$dashAddr.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $dashResults.val("No wallet?");
    return;
  }
  if (core.supportsBTC(wallet)) {
    const res = await wallet.btcGetAddress({
      addressNList: dashBip44.addressNList.concat([0, 0]),
      coin: "Dash",
      scriptType: dashBip44.scriptType,
      showDisplay: true,
    });
    $dashResults.val(res);
  } else {
    const label = await wallet.getLabel();
    $dashResults.val(label + " does not support Dash");
  }
});

$dashTx.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $dashResults.val("No wallet?");
    return;
  }
  if (core.supportsBTC(wallet)) {
    const txid = "94b3bbe89e5106d93d07be311a543958fa0de127d4bf747e9102c43e92cbb55f";
    const hex =
      "0100000001816b126842a9703a2c003cd32108d33b345bce68726bb4341fccf3703704c605000000006b483045022100f23368614d166894e5c75e3a99413b72b30ce45d13c00a50e836380819582c8602206bee0e276d684c794becf27f23426d0da457fcfedbb8c4a86bd3657ca357ee1c0121036ac34cb12ac492c0eb0d1a07bd73a5a5f08bc6ba27b710276073704de9912921ffffffff01f7984b00000000001976a914ed52e17e6d182a28148c3719385ced4e30b5c0bb88ac00000000";

    const inputs = [
      {
        addressNList: dashBip44.addressNList.concat([0, 0]),
        scriptType: core.BTCInputScriptType.SpendAddress,
        amount: String(4954359),
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
        addressType: core.BTCOutputAddressType.Spend,
        scriptType: core.BTCOutputScriptType.PayToAddress,
        amount: String(4000000),
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
    const label = await wallet.getLabel();
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
  scriptType: core.BTCInputScriptType.SpendAddress,
  addressNList: [0x80000000 + 44, 0x80000000 + 20, 0x80000000 + 0],
};

$dgbAddr.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $dgbResults.val("No wallet?");
    return;
  }
  if (core.supportsBTC(wallet)) {
    const res = await wallet.btcGetAddress({
      addressNList: dgbBip44.addressNList.concat([0, 0]),
      coin: "DigiByte",
      scriptType: dgbBip44.scriptType,
      showDisplay: true,
    });
    $dgbResults.val(res);
  } else {
    const label = await wallet.getLabel();
    $dgbResults.val(label + " does not support Dash");
  }
});

$dgbTx.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $dgbResults.val("No wallet?");
    return;
  }

  // use all mnemonic as there is no valid tx on alcohol abuse to use for Native signing
  await wallet.loadDevice({
    mnemonic: "all all all all all all all all all all all all",
  });

  if (core.supportsBTC(wallet)) {
    const inputs = [
      {
        addressNList: dgbBip44.addressNList.concat([0, 0]),
        scriptType: core.BTCInputScriptType.SpendAddress,
        amount: String(480000000),
        vout: 15,
        txid: "be150359df4123b379f1f12de978bfced92644645da17b97c7613879f4306a90",
        tx: null,
        hex: "01000000010b89406fd53f648dbf5cc7a46443794487684833c4bb7a067c86bdcf88362d4b010000006b4830450221009b38f01ca6b06c9fddb5d17ecaf306b140181074e06d50d38b4f61bc81c34d0202200eb9d37f551f6599a3488a8215cf53a347ced76b1dfb1c171855390a5576cd5a012102ee6d4720bc42ae172a1b1fbd1c0fccf4b9f364054f5ba1681f5e206c3b3a4d65ffffffff14486b9e7e750000001976a914f972645c9db830433fe9672b55452b4310c9501288ac0066a957160000001976a914584df25dff6f9eff9a86f2a49807249417913de288ac00bb4547170000001976a914cf934b123f7d1d0e6ecceff45dd881c6b3a1a7c588ac0020bcbe000000001976a91445ef856d2aa149ad66c4f98b115cd53ac88bcbbe88ac0063fe4e090000001976a91464d0c1a15eedb75f74a05b7282bbfc425e9a41ef88ac008b10e72e0300001976a91423cacb5aa41a375e057a38920396e889dd431e4d88ac6b884a1e0f0000001976a9149a32a47d48569012e3539a4be52c9436af9337a788ac003d7bc1210000001976a9147ba2fcb7d0d1321d8501019c2d9f68848e70bf7a88ac00389c1c0000000017a914d3b07c1aaea886f8ceddedec440623f812e49ddc87599e220afc0000001976a914e05ed2af3b5e20f3481e17fa26ef220a70237d7f88ac5475e2d91c0000001976a9147403f2f35e9c9e1f465a34d03afb7ff85f50770588acc9a9ce043c0000001976a914510fffca0668d410aea742e95a2fefa7952f695e88acf8f71c55890000001976a914916014ab503133671da74cfa18570debc332d63888acdfdeae45000000001976a9149cfc24e08cb9189839b0b5c973dec6cc1e1e662488ac8d10f92b954000001976a91433eed4c1b486b6c51824eab5a5d25dc47e0acc7e88ac00389c1c000000001976a914a4b8f22d44a76f96e035a75e01d55fc4cad081e188ac855ed4696f0000001976a9148d18463cb1e415242e49dfd3154a0edfcf16f25988ac439d5ff7180000001976a9144227b8ea4d92a707402bc96378a19ff5d83c5f9088ac9d2724980e0000001976a914b721f681fdbf9541cc5e2aed31a1fbb16a727fdf88ac893d1cf2e20000001976a91442f1d1103b1e9e10efdb5a0b1b88dfe627467dc288ac00000000",
      },
      {
        addressNList: dgbBip44.addressNList.concat([0, 0]),
        scriptType: core.BTCInputScriptType.SpendAddress,
        amount: String(10000000),
        vout: 0,
        txid: "528ec23eaf123282e9bce297ebb3edfb05e8b4d5875cbc9c271a98d72a202340",
        tx: null,
        hex: "0100000001442377be8a2c1d8769dd417382f8ac1a35f33c86de89e2dcf997522e7ae9e6b7000000006a473044022004f4072085e7a9e1f84cb77653f02f7a5b301b3d3514fe750e86d42f617c429a0220338f779601a38ff18c7adfd1a1ccd8f723de12ff4f9c41b7b72f1c0f6f4738ac012103723d91852ec39078fb9d167fe2c4e86be1325057d707ab69ce625699d86a537fffffffff0280969800000000001976a914a4b8f22d44a76f96e035a75e01d55fc4cad081e188ac66e00c16000000001976a9144afe51fbe5fb6cd4814ce74b31d7535a5f4a63bc88ac00000000",
      },
    ];

    const outputs = [
      {
        address: "SWpe93hQL2pLUDLy7swsDPWQJGCHSsgmun",
        addressType: null,
        scriptType: core.BTCOutputScriptType.PayToMultisig,
        amount: String(400000000),
        isChange: false,
      },
      {
        address: "DNLcBry65dHehGExGYjBkM8kxDYr7mZ3BT",
        addressType: null,
        scriptType: core.BTCOutputScriptType.PayToAddress,
        relpath: "1/9",
        amount: String(90000000),
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
    const label = await wallet.getLabel();
    $dgbResults.val(label + " does not support Dash");
  }

  // set mnemonic back to alcohol abuse
  await wallet.loadDevice({ mnemonic });
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
  if (core.supportsBTC(wallet)) {
    //coin 0 (mainnet bitcoin)
    //path 0
    const res = await wallet.btcGetAddress({
      addressNList: [0x80000000 + 49, 0x80000000 + 0, 0x80000000 + 0, 0, 0],
      coin: "Bitcoin",
      scriptType: core.BTCInputScriptType.SpendP2SHWitness,
      showDisplay: true,
    });

    $btcResultsSegWit.val(res);
  } else {
    const label = await wallet.getLabel();
    $btcResultsSegWit.val(label + " does not support BTC");
  }
});

$btcAddrSegWitNative.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $btcResultsSegWit.val("No wallet?");
    return;
  }
  if (core.supportsBTC(wallet)) {
    //coin 0 (mainnet bitcoin)
    //path 0
    const res = await wallet.btcGetAddress({
      addressNList: [0x80000000 + 84, 0x80000000 + 0, 0x80000000 + 0, 0, 0],
      coin: "Bitcoin",
      scriptType: core.BTCInputScriptType.SpendWitness,
      showDisplay: true,
    });
    $btcResultsSegWit.val(res);
  } else {
    const label = await wallet.getLabel();
    $btcResultsSegWit.val(label + " does not support BTC");
  }
});

$btcTxSegWit.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $btcResultsSegWit.val("No wallet?");
    return;
  }
  if (core.supportsBTC(wallet)) {
    const txid = "609410a9eac51cdce2b9c1911c7b8705bc566e164bca07ae25f2dee87b5b6a91";
    const hex =
      "01000000021b09436d8f9fae331e8810ca8ddf5b2bac1c95338a98280ad75efb6773d54a03000000006b48304502210081734b9b58d109997241c85806e6a5c97ba79f4a76ddb98eb227626b21ac1d290220534bee7f3f2a1803b851570b62825a589b5989f69afa44ddee5b591b8f822d3d012103fa044f4e622a9dc7a877155efad20816c6994f95bd1dc21c339a820395a32e01ffffffffe4b64ecf01f1b2e2a8c0ca86662fada7abbb991e9b4974217f5977623d515ea1010000006b4830450221008a2c95c61db777e15ebb7220c9a84565080ed87b97778a0417854fefa87e447202205dafb62309770a98868737d25bc7779caffa4b50993c36c93acf1f07a5d6d69b012102000b4b1051a63e82eeede1f1990ab226685f83ba104a0946edc740e17ce2958bffffffff02a08601000000000017a91463c4b3af0eb54b8b58b07fbde95a4ab3af3b8735874f161100000000001976a91430f7daeb4336f786cb0cf3bb162d83393681ca2d88ac00000000";

    const inputs = [
      {
        addressNList: [0x80000000 + 49, 0x80000000 + 0, 0x80000000 + 0, 0, 0],
        amount: String(100000),
        vout: 0,
        txid: txid,
        scriptType: core.BTCInputScriptType.SpendP2SHWitness,
        tx: btcSegWitTxJson,
        hex,
      },
    ];

    const outputs: core.BTCSignTxOutput[] = [
      {
        address: "3Eq3agTHEhMCC8sZHnJJcCcZFB7BBSJKWr",
        addressType: core.BTCOutputAddressType.Spend,
        scriptType: core.BTCOutputScriptType.PayToAddress,
        amount: String(89869),
        isChange: false,
      },
    ];
    const res = await wallet.btcSignTx({
      coin: "Bitcoin",
      inputs: inputs,
      outputs: outputs,
      version: 1,
      locktime: 0,
    });
    $btcResultsSegWit.val(res.serializedTx);
  } else {
    const label = await wallet.getLabel();
    $btcResultsSegWit.val(label + " does not support BTC");
  }
});

$btcTxSegWitNative.on("click", async (e) => {
  e.preventDefault();
  if (!wallet) {
    $btcResultsSegWit.val("No wallet?");
    return;
  }

  // use all mnemonic as there is no valid tx on alcohol abuse to use for Native signing
  await wallet.loadDevice({
    mnemonic: "all all all all all all all all all all all all",
  });

  if (core.supportsBTC(wallet)) {
    const txid = "fa80a9949f1094119195064462f54d0e0eabd3139becd4514ae635b8c7fe3a46";
    const hex =
      "01000000000101360d7a720e95a6068678eb08e91b3a8a4774222c9f34becf57d0dc4329e0a686000000001716001495f41f5c0e0ec2c7fe27f0ac4bd59a5632a40b5fffffffff02d224000000000000160014ece6935b2a5a5b5ff997c87370b16fa10f16441088ba04000000000017a914dfe58cc93d35fb99e15436f47d3bbfce820328068702483045022100f312e8246e6a00d21fd762f12231c5fb7a20094a32940b9a84e28d712a5ced9b02203b9124d7a94aa7eb1e090ceda32e884511d7068b8d47593aa46537900e3e37d40121037e8bf05c6c7223cfba3ea484ecd61ee910ae38609ea89b4a4839beed2186b3fb00000000";

    const inputs = [
      {
        addressNList: [0x80000000 + 84, 0x80000000 + 0, 0x80000000 + 0, 0, 0],
        amount: String(9426),
        vout: 0,
        txid: txid,
        scriptType: core.BTCInputScriptType.SpendWitness,
        tx: btcBech32TxJson,
        hex,
      },
    ];

    const outputs: core.BTCSignTxOutput[] = [
      {
        address: "bc1qc5dgazasye0yrzdavnw6wau5up8td8gdqh7t6m",
        addressType: core.BTCOutputAddressType.Spend,
        scriptType: core.BTCOutputScriptType.PayToAddress,
        amount: String(1337),
        isChange: false,
      },
    ];
    const res = await wallet.btcSignTx({
      coin: "Bitcoin",
      inputs: inputs,
      outputs: outputs,
      version: 1,
      locktime: 0,
    });
    $btcResultsSegWit.val(res.serializedTx);
  } else {
    const label = await wallet.getLabel();
    $btcResultsSegWit.val(label + " does not support BTC");
  }

  // set mnemonic back to alcohol abuse
  await wallet.loadDevice({ mnemonic });
});
