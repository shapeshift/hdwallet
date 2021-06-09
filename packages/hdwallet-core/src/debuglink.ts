import { HDWallet } from "./wallet";

export interface DebugLinkWallet extends HDWallet {
  readonly _supportsDebugLink: boolean;

  pressYes(): Promise<void>;
  pressNo(): Promise<void>;
  press(isYes: boolean): Promise<void>;
}
