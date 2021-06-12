import * as core from "@shapeshiftoss/hdwallet-core";

export interface LedgerResponse {
  success: boolean;
  payload: any | { error: string };
  coin: core.Coin;
  method: string;
}

export abstract class LedgerTransport extends core.Transport {
  transport: any;

  constructor(transport: any, keyring: core.Keyring) {
    super(keyring);
    this.transport = transport;
  }

  public abstract call(coin: string, method: string, ...args: any[]): Promise<LedgerResponse>;
}
