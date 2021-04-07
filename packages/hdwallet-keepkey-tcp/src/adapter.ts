import { HDWallet, Keyring } from "@shapeshiftoss/hdwallet-core";
import { create as createKeepKey } from "@shapeshiftoss/hdwallet-keepkey";
import { AxiosRequestConfig } from "axios";
import { TCPKeepKeyTransport } from "./transport";

export class TCPKeepKeyAdapter {
  keyring: Keyring;

  constructor(keyring: Keyring) {
    this.keyring = keyring;
  }

  public static useKeyring(keyring: Keyring) {
    return new TCPKeepKeyAdapter(keyring);
  }

  public async initialize(hostsOrConfigs: Array<string | AxiosRequestConfig>): Promise<number> {
    for (const hostOrConfig of hostsOrConfigs) {
      const host = typeof hostOrConfig === "string" ? hostOrConfig : hostOrConfig.baseURL;
      if (this.keyring.wallets[host]) {
        await this.keyring.get(host).transport.connect();
        await this.keyring.get(host).initialize();
      } else {
        let transport = new TCPKeepKeyTransport(hostOrConfig, this.keyring);

        await transport.connect();
        let wallet = createKeepKey(transport);

        await wallet.initialize();
        this.keyring.add(wallet, host);
      }
    }
    return Object.keys(this.keyring.wallets).length;
  }

  public async pairDevice(hostOrConfig: string | AxiosRequestConfig): Promise<HDWallet> {
    const host = typeof hostOrConfig === "string" ? hostOrConfig : hostOrConfig.baseURL;
    await this.initialize([hostOrConfig]);
    return this.keyring.get(host);
  }
}
