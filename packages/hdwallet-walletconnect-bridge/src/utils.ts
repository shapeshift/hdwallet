import { ChainNamespace } from "@shapeshiftoss/caip";
import * as core from "@shapeshiftoss/hdwallet-core";

export const addressNList = core.bip32ToAddressNList("m/44'/60'/0'/0/0");

export const getAccountId = async (
  wallet: core.ETHWallet,
  accountId: string | null,
  chainId: string
): Promise<string> => {
  const address = accountId ?? (await wallet.ethGetAddress({ addressNList }));
  return `${ChainNamespace.Ethereum}:${chainId}/${address}`;
};
