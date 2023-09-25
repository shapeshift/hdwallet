// Taken from https://github.com/LedgerHQ/ledgerjs/blob/master/packages/cryptoassets/src/currencies.ts#L299

type Currency = { name: string; xpubVersion: number };

export const currencies: Record<string, Currency> = {
  Bitcoin: {
    name: "Bitcoin",
    xpubVersion: 0x0488b21e,
  },
  BitcoinCash: {
    name: "Bitcoin Cash",
    xpubVersion: 0x0488b21e,
  },
  Dogecoin: {
    name: "Dogecoin",
    xpubVersion: 0x02facafd,
  },
  Litecoin: {
    name: "Litecoin",
    xpubVersion: 0x019da462,
  },
};
