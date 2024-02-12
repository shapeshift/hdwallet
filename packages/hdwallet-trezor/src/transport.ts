import * as core from "@shapeshiftoss/hdwallet-core";

export interface TrezorConnectResponse {
  success: boolean;
  payload: any | { error: string };
}

export abstract class TrezorTransport extends core.Transport {
  hasPopup = false;

  constructor(keyring: core.Keyring) {
    super(keyring);
  }

  public abstract cancel(): Promise<void>;

  public abstract call(method: string, msg: any, msTimeout?: number): Promise<TrezorConnectResponse>;
}
