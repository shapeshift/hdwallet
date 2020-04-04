import { Transport, Keyring } from "@shapeshiftoss/hdwallet-core";

export interface TrezorConnectResponse {
  success: boolean;
  payload: any | { error: string };
}

export abstract class TrezorTransport extends Transport {
  hasPopup: boolean;

  constructor(keyring: Keyring) {
    super(keyring);
  }

  public abstract async listen(): Promise<any>;

  public abstract async cancel(): Promise<void>;

  public abstract async call(
    method: string,
    msg: any,
    msTimeout?: number
  ): Promise<TrezorConnectResponse>;
}
