import * as core from "@shapeshiftoss/hdwallet-core";

export type InfoCreater = () => core.HDWalletInfo;
export type Creater = (type?: any) => Promise<core.HDWallet>;
export type Getter = () => core.HDWallet;
export type Suite = (get: Getter) => void;

/**
 * Each HDWallet testsuite implementation is expected to export this common
 * interface.
 */
export interface WalletSuite {
  /**
   * Fetch a short description of the HDWallet implementation being tested.
   */
  name: () => string;

  /**
   * Construct an insance of the HDWalletInfo to test against.
   */
  createInfo: InfoCreater;

  /**
   * Construct an instance of the HDWallet to test against.
   */
  createWallet: Creater;

  /**
   * Tests specific to the particular HDWallet imeplemtation.
   */
  selfTest: Suite;
}
