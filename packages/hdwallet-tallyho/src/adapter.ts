import * as core from "@shapeshiftoss/hdwallet-core";
import TallyHoOnboarding from "tallyho-onboarding";

import { TallyHoHDWallet } from "./tallyho";

interface TallyHoEthereumProvider {
  isTally?: boolean;
}

interface Window {
  ethereum?: TallyHoEthereumProvider;
}

export class TallyHoAdapter {
  keyring: core.Keyring;

  private constructor(keyring: core.Keyring) {
    this.keyring = keyring;
  }

  public static useKeyring(keyring: core.Keyring) {
    return new TallyHoAdapter(keyring);
  }

  public async pairDevice(): Promise<TallyHoHDWallet> {
    let provider: any;
    // eslint-disable-next-line no-useless-catch
    try {
      provider = await this.detectTallyProvider();
    } catch (error) {
      throw error;
    }
    if (!provider) {
      const onboarding = new TallyHoOnboarding();
      onboarding.startOnboarding();
      console.error("Please install Tally Ho!");
    }
    if (provider === null) {
      throw new Error("Could not get Tally Ho accounts.");
    }

    // eslint-disable-next-line no-useless-catch
    try {
      await provider.request({ method: "eth_requestAccounts" });
    } catch (error) {
      throw error;
    }
    const wallet = new TallyHoHDWallet(provider);
    const deviceID = await wallet.getDeviceID();
    this.keyring.add(wallet, deviceID);
    this.keyring.emit(["Tally Ho", deviceID, core.Events.CONNECT], deviceID);

    return wallet;
  }

  /*
   * Tally works the same way as metamask.
   * This code is copied from the @metamask/detect-provider package
   * @see https://www.npmjs.com/package/@metamask/detect-provider
   */
  private async detectTallyProvider(): Promise<TallyHoEthereumProvider | null> {
    let handled = false;

    return new Promise((resolve) => {
      if ((window as Window).ethereum) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        handleEthereum();
      } else {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        window.addEventListener("ethereum#initialized", handleEthereum, { once: true });

        setTimeout(() => {
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          handleEthereum();
        }, 3000);
      }

      function handleEthereum() {
        if (handled) {
          return;
        }
        handled = true;

        window.removeEventListener("ethereum#initialized", handleEthereum);

        const { ethereum } = window as Window;

        if (ethereum && ethereum.isTally) {
          resolve(ethereum as unknown as TallyHoEthereumProvider);
        } else {
          const message = ethereum ? "Non-TallyHo window.ethereum detected." : "Unable to detect window.ethereum.";

          console.error("hdwallet-tallyho: ", message);
          resolve(null);
        }
      }
    });
  }
}
