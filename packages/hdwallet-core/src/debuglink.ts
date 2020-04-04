export interface DebugLinkWallet {
  _supportsDebugLink: boolean;

  pressYes(): Promise<void>;
  pressNo(): Promise<void>;
  press(isYes: boolean): Promise<void>;
}
