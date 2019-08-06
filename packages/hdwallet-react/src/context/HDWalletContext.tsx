import React from "react";
import { Keyring,     
    // HDWallet, 
    // Events
 } from "@shapeshiftoss/hdwallet-core";
 
// import { WebUSBKeepKeyAdapter } from "@shapeshiftoss/hdwallet-keepkey-webusb";
// import { TrezorAdapter } from "@shapeshiftoss/hdwallet-trezor-connect";

export interface HDWalletContextValue {
    keyring: Keyring
}


let hdWalletContext: React.Context<HDWalletContextValue>

export function getHDWalletContext() {
  if (!hdWalletContext) {
    hdWalletContext = React.createContext<HDWalletContextValue>({});
  }
  return hdWalletContext;
}

export function resethdWalletContext() {
  hdWalletContext = React.createContext<HDWalletContextValue>({});
}