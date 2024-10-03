import * as core from "@shapeshiftoss/hdwallet-core";
import { enableShapeShiftSnap, shapeShiftSnapInstalled } from "@shapeshiftoss/metamask-snaps-adapter";
import { createStore } from "mipd";

import { SNAP_ID } from "./common";
import { MetaMaskShapeShiftMultiChainHDWallet } from "./shapeshift-multichain";

// https://github.com/wevm/wagmi/blob/21245be51d7c6dff1c7b285226d0c89c4a9d8cac/packages/connectors/src/utils/getInjectedName.ts#L6-L56
// This will need to be kept up-to-date with the latest list of impersonators
const METAMASK_IMPERSONATORS = [
  "isBraveWallet",
  "isTokenary",
  "isFrame",
  "isLiquality",
  "isOpera",
  "isTally",
  "isStatus",
  "isXDEFI",
  "isNifty",
  "isRonin",
  "isBinance",
  "isCoinbase",
  "isExodus",
  "isPhantom",
  "isGlow",
  "isOneInch",
  "isRabby",
  "isTrezor",
  "isLedger",
  "isKeystone",
  "isBitBox",
  "isGridPlus",
  "isJade",
  "isPortis",
  "isFortmatic",
  "isTorus",
  "isAuthereum",
  "isWalletLink",
  "isWalletConnect",
  "isDapper",
  "isBitski",
  "isVenly",
  "isSequence",
  "isGamestop",
  "isZerion",
  "isDeBank",
  "isKukai",
  "isTemple",
  "isSpire",
  "isWallet",
  "isCore",
  "isAnchor",
  "isWombat",
  "isMathWallet",
  "isMeetone",
  "isHyperPay",
  "isTokenPocket",
  "isBitpie",
  "isAToken",
  "isOwnbit",
  "isHbWallet",
  "isMYKEY",
  "isHuobiWallet",
  "isEidoo",
  "isTrust",
  "isImToken",
  "isONTO",
  "isSafePal",
  "isCoin98",
  "isVision",
];

const store = createStore();

export class MetaMaskAdapter {
  keyring: core.Keyring;
  providerRdns: string;

  private constructor(keyring: core.Keyring, providerRdns: string) {
    this.keyring = keyring;
    this.providerRdns = providerRdns;
  }

  public static useKeyring(keyring: core.Keyring, providerRdns: string) {
    return new MetaMaskAdapter(keyring, providerRdns);
  }

  public async initialize(): Promise<number> {
    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<MetaMaskShapeShiftMultiChainHDWallet | undefined> {
    const maybeEip6963Provider = store.findProvider({ rdns: this.providerRdns });
    if (!maybeEip6963Provider) throw new Error("EIP-6963 provider not found");
    const eip1193Provider = maybeEip6963Provider.provider;

    // Checking for the truthiness of the value isn't enough - some impersonators have the key present but undefined
    // This is weird, but welcome to the world of web3
    const isMetaMaskImpersonator = METAMASK_IMPERSONATORS.some((impersonator) => impersonator in eip1193Provider);

    if (!isMetaMaskImpersonator && !shapeShiftSnapInstalled(SNAP_ID)) {
      console.info("ShapeShift Multichain snap not found. Prompting user to install.");
      const result = await enableShapeShiftSnap(SNAP_ID);
      if (result.success === false) {
        throw new Error("Could not install ShapeShift Multichain snap");
      }
    }
    try {
      await eip1193Provider.request?.({ method: "eth_requestAccounts" }).catch(() =>
        eip1193Provider.request?.({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }],
        })
      );
    } catch (error) {
      console.error("Could not get MetaMask accounts. ");
      throw error;
    }
    const wallet = new MetaMaskShapeShiftMultiChainHDWallet(eip1193Provider);
    await wallet.initialize();
    const deviceID = await wallet.getDeviceID();
    this.keyring.add(wallet, deviceID);
    this.keyring.emit(["MetaMask(ShapeShift Multichain)", deviceID, core.Events.CONNECT], deviceID);

    return wallet;
  }
}
