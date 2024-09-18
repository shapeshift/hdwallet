import { providers } from "ethers";

export type PhantomEvmProvider = providers.ExternalProvider & {
  _metamask: {
    isUnlocked: () => boolean;
  };
};
