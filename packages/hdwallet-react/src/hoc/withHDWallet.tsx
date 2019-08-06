import React from "react";
import { HDWalletConsumer } from "../context/HDWalletConsumer";
import hoistNonReactStatics from "hoist-non-react-statics";
import { Keyring } from "@shapeshiftoss/hdwallet-core";

function getDisplayName<P>(WrappedComponent: React.ComponentType<P>) {
  return WrappedComponent.displayName || WrappedComponent.name || "Component";
}

type WithHDWallet<P> = P & { keyring: Keyring<any> };

export function withHDWallet<TProps, TResult = any>(
  WrappedComponent: React.ComponentType<WithHDWallet<Omit<TProps, "hdWallet">>>
): React.ComponentClass<Omit<TProps, "hdWallet">> {
  const withDisplayName = `withHDWallet(${getDisplayName(WrappedComponent)})`;

  class WithHDWallet extends React.Component<Omit<TProps, "hdWallet">> {
    static displayName = withDisplayName;
    static WrappedComponent = WrappedComponent;

    constructor(props: Omit<TProps, "hdWallet">) {
      super(props);
    }

    render() {
      return (
        <HDWalletConsumer>
          {hdWallet => {
            const props = Object.assign({}, this.props, {
              hdWallet
            });
            return <WrappedComponent {...props} />;
          }}
        </HDWalletConsumer>
      );
    }
  }

  // Make sure we preserve any custom statics on the original component.
  return hoistNonReactStatics(WithHDWallet, WrappedComponent, {});
}
