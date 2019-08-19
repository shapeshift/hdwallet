import React from "react";
import { HDWalletConsumer } from "../context/HDWalletConsumer";
import { HDWalletContextValue } from "../context/HDWalletContext";
import hoistNonReactStatics from "hoist-non-react-statics";

function getDisplayName<P>(WrappedComponent: React.ComponentType<P>) {
  return WrappedComponent.displayName || WrappedComponent.name || "Component";
}

type WithHDWallet<P> = P & { hdWallet: HDWalletContextValue };

export function withHDWallet<TProps>(
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
