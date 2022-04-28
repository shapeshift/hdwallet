import * as core from "@shapeshiftoss/hdwallet-core";
import QRCodeModal from "@walletconnect/qrcode-modal";
import WalletConnect from "@walletconnect/client";

export class WalletConnectAdapter {
  keyring: core.Keyring;

  private constructor(keyring: core.Keyring) {
    this.keyring = keyring;
  }

  public static useKeyring(keyring: core.Keyring) {
    return new WalletConnectAdapter(keyring);
  }

  public async pairDevice(): Promise<WalletConnect> {
    const connector = new WalletConnect({
      bridge: "https://bridge.walletconnect.org",
      qrcodeModal: QRCodeModal,
    })

    if (!connector.connected) {
      connector.createSession();
    }

    return connector
  }
}