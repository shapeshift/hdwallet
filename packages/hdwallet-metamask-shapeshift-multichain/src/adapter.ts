import detectEthereumProvider from "@metamask/detect-provider";
import MetaMaskOnboarding from "@metamask/onboarding";
import * as core from "@shapeshiftoss/hdwallet-core";
import { enableShapeShiftSnap, shapeShiftSnapInstalled } from "@shapeshiftoss/metamask-snaps-adapter";
import { providers } from "ethers";

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

export class MetaMaskAdapter {
  keyring: core.Keyring;

  private constructor(keyring: core.Keyring) {
    this.keyring = keyring;
  }

  public static useKeyring(keyring: core.Keyring) {
    return new MetaMaskAdapter(keyring);
  }

  public async initialize(): Promise<number> {
    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(): Promise<MetaMaskShapeShiftMultiChainHDWallet | undefined> {
    // TODO: remove casting, @metamask/detect-provider npm package hasn't been published with latest typings
    // https://github.com/MetaMask/detect-provider/blame/5ce916fc24779c4b36741531a41d9c8b3cbb0a17/src/index.ts#L37
    const provider = (await detectEthereumProvider({
      mustBeMetaMask: true,
      silent: false,
      timeout: 3000,
    })) as providers.ExternalProvider | null;
    if (!provider) {
      const onboarding = new MetaMaskOnboarding();
      onboarding.startOnboarding();
      console.error("Please install MetaMask!");
      throw new Error("MetaMask provider not found");
    }

    // Checking for the truthiness of the value isn't enough - some impersonators have the key present but undefined
    // This is weird, but welcome to the world of web3
    const isMetaMaskImpersonator = METAMASK_IMPERSONATORS.some((impersonator) => impersonator in provider);

    if (!isMetaMaskImpersonator && !shapeShiftSnapInstalled(SNAP_ID)) {
      console.info("ShapeShift Multichain snap not found. Prompting user to install.");
      const result = await enableShapeShiftSnap(SNAP_ID);
      if (result.success === false) {
        throw new Error("Could not install ShapeShift Multichain snap");
      }
    }
    try {
      await provider.request?.({ method: "eth_requestAccounts" }).catch(() =>
        provider.request?.({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }],
        })
      );
    } catch (error) {
      console.error("Could not get MetaMask accounts. ");
      throw error;
    }
    const wallet = new MetaMaskShapeShiftMultiChainHDWallet(provider);
    await wallet.initialize();
    const deviceID = await wallet.getDeviceID();
    this.keyring.add(wallet, deviceID);
    this.keyring.emit(["MetaMask(ShapeShift Multichain)", deviceID, core.Events.CONNECT], deviceID);

    return wallet;
  }
}
