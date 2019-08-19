import React from "react";

import { getHDWalletContext, HDWalletContextValue } from "./HDWalletContext";
import { invariant } from "ts-invariant";

export interface HDWalletConsumerProps {
  children: (hdWallet: HDWalletContextValue) => React.ReactChild | null;
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
        return props.children({ ...context });
      }}
    </HDWalletContext.Consumer>
  );
};
