import React from "react";
import { Keyring, HDWallet, Events } from "@shapeshiftoss/hdwallet-core";
import { WebUSBKeepKeyAdapter } from "@shapeshiftoss/hdwallet-keepkey-webusb";
import { TrezorAdapter } from "@shapeshiftoss/hdwallet-trezor-connect";

import { getHDWalletContext } from "./HDWalletContext";

const HDWalletContext = getHDWalletContext();

type Adapter = any;

interface HDWalletProviderProps {
  adapters: { name: string; adapter: Adapter; config?: any }[];
}

/* 
  Seperation of concerns:
    * Pin Required
    * Passphrase Required
    * Which wallet(s) are connected
 */
export class HDWalletProvider extends React.Component<HDWalletProviderProps> {
  keyring: Keyring = new Keyring();
  adapters: {
    name: string;
    adapter: Adapter;
    config: {};
  }[] = [];

  state: {
    pairedDevices: { [index: string]: HDWallet };
  } = {
    pairedDevices: {}
  };

  static defaultProps = {
    adapters: []
  };

  async componentDidMount() {
    // This might break SSR
    // Attach each of the adapters to the Keyring
    const adapters = this.props.adapters.map(({ name, adapter, config }) => {
      // TODO - Ask Jon why this is breaking 🤷‍♂️
      return {
        name,
        adapter: (adapter as any).useKeyring(this.keyring, config),
        config
      };
    });

    // Initialize each of the adapters
    await Promise.all(
      adapters.map(async ({ name, adapter, config }) => {
        console.debug(`[HDWallet] - ✅ Initializing ${name} adapter`, config);
        try {
          return await adapter.initialize(/* undefined, false, false*/);
        } catch (err) {
          console.error(err.message);
        }
      })
    );

    this.keyring.on(["*", "*", Events.CONNECT], this.handleDeviceConnect);
    this.keyring.on(["*", "*", Events.DISCONNECT], this.handleDeviceDisconnect);

    // This will fail out of sync if device is connected/disconnected
    const pairedDevices = this.keyring.wallets;
    this.adapters = adapters;

    this.setState({
      pairedDevices
    });
  }

  componentWillUnmount() {
    this.keyring.off(`*.*.${Events.CONNECT}`, this.handleDeviceConnect);
    this.keyring.off(`*.*.${Events.DISCONNECT}`, this.handleDeviceDisconnect);
  }

  handleDeviceConnect = (deviceID: string) => {
    console.debug(`[HDWallet] - ✅🔌 Paired Device Connected: ${deviceID}`);
    this.setState({ pairedDevices: this.keyring.wallets });
  };

  handleDeviceDisconnect = (deviceID: string) => {
    console.debug(`[HDWallet] - ❌🔌 Paired Device Disconnected: ${deviceID}`);
    this.setState({ pairedDevices: this.keyring.wallets });
  };

  getAdapter = (
    adapterName: string
  ): WebUSBKeepKeyAdapter | TrezorAdapter | any => {
    const adapter = this.adapters.find(({ name }) => name === adapterName);
    if (!adapter) {
      console.log("Adapter not found");
      return;
    }

    return adapter.adapter;
  };

  render() {
    return (
      <HDWalletContext.Provider
        value={{
          keyring: this.keyring,
          pairedDevices: this.state.pairedDevices,
          getAdapter: this.getAdapter
        }}
      >
        {this.props.children}
      </HDWalletContext.Provider>
    );
  }
}

export default HDWalletContext;
