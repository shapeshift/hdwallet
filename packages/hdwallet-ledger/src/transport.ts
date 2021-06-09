import * as core from "@shapeshiftoss/hdwallet-core";
import Transport from "@ledgerhq/hw-transport";

export interface LedgerResponse {
  success: boolean;
  payload: any | { error: string };
  coin: core.Coin;
  method: string;
}

export abstract class LedgerTransport extends core.Transport {
  transport: Transport;

  constructor(transport: Transport, keyring: core.Keyring) {
    super(keyring);
    this.transport = transport;
  }

  public abstract call(coin: string | null, method: string, ...args: any[]): Promise<LedgerResponse>;
}
