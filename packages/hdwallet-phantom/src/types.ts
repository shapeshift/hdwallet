import { providers } from "ethers";

import { BtcAccount } from "./bitcoin";

export type PhantomEvmProvider = providers.ExternalProvider & {
  _metamask: {
    isUnlocked: () => boolean;
  };
};

export type PhantomUtxoProvider = providers.ExternalProvider & {
  requestAccounts: () => Promise<BtcAccount[]>;
  signMessage: (
    address: string,
    message: Uint8Array
  ) => Promise<{
    signature: Uint8Array;
  }>;
};
