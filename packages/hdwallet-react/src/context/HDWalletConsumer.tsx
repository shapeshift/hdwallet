import React from "react";
import {
  Keyring,
  HDWallet
  // Events
} from "@shapeshiftoss/hdwallet-core";

import { WebUSBKeepKeyAdapter } from "@shapeshiftoss/hdwallet-keepkey-webusb";
import { TrezorAdapter } from "@shapeshiftoss/hdwallet-trezor-connect";

import { getHDWalletContext } from "./HDWalletContext";
import { invariant } from "ts-invariant";

export interface HDWalletConsumerProps {
  children: (
    keyring: Keyring,
    pairedDevices: { [index: string]: HDWallet },
    getAdapter: () => WebUSBKeepKeyAdapter | TrezorAdapter | any
  ) => React.ReactChild | null;
}

export const HDWalletConsumer: React.FC<HDWalletConsumerProps> = props => {
  const HDWalletContext = getHDWalletContext();
  return (
    <HDWalletContext.Consumer>
      {(context: any) => {
        invariant(
          context && context.keyring,
          'Could not find "keyring" in the context of HDWalletConsumer. ' +
            "Wrap the root component in an <HDWalletProvider>."
        );
        return props.children(context.keyring);
      }}
    </HDWalletContext.Consumer>
  );
};
