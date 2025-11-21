import * as bitcoin from "@shapeshiftoss/bitcoinjs-lib";

import { BTCScriptType } from "./bitcoin";

type BIP32 = {
  public: number;
  private: number;
};

type BIP32ByScriptType = Partial<Record<BTCScriptType, BIP32>>;

const bip32: BIP32ByScriptType = {
  [BTCScriptType.Legacy]: {
    public: 0x0488b21e,
    private: 0x0488ade4,
  },
  [BTCScriptType.LegacyMultisig]: {
    public: 0x0488b21e,
    private: 0x0488ade4,
  },
  [BTCScriptType.Segwit]: {
    public: 0x049d7cb2,
    private: 0x049d7878,
  },
  [BTCScriptType.SegwitNative]: {
    public: 0x04b24746,
    private: 0x04b2430c,
  },
};

type Network = Omit<bitcoin.Network, "bip32"> & { bip32: BIP32ByScriptType };
type Networks = Record<string, Network>;

const networks: Networks = {
  bitcoin: {
    messagePrefix: "\x18Bitcoin Signed Message:\n",
    bech32: "bc",
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80,
    bip32,
  },
  dash: {
    messagePrefix: "unused",
    bech32: "",
    pubKeyHash: 0x4c,
    scriptHash: 0x10,
    wif: 0xcc,
    bip32: {
      [BTCScriptType.Legacy]: bip32[BTCScriptType.Legacy],
      [BTCScriptType.LegacyMultisig]: bip32[BTCScriptType.LegacyMultisig],
    },
  },
  digibyte: {
    messagePrefix: "\x19Digibyte Signed Message:\n",
    bech32: "dgb",
    pubKeyHash: 0x1e,
    scriptHash: 0x3f,
    wif: 0x80,
    bip32,
  },
  dogecoin: {
    messagePrefix: "\x19Dogecoin Signed Message:\n",
    bech32: "",
    pubKeyHash: 0x1e,
    scriptHash: 0x16,
    wif: 0x9e,
    bip32: {
      [BTCScriptType.Legacy]: {
        public: 0x02facafd,
        private: 0x02fac398,
      },
      [BTCScriptType.LegacyMultisig]: {
        public: 0x02facafd,
        private: 0x02fac398,
      },
    },
  },
  litecoin: {
    messagePrefix: "\x19Litecoin Signed Message:\n",
    bech32: "ltc",
    pubKeyHash: 0x30,
    scriptHash: 0x32,
    wif: 0xb0,
    bip32: {
      [BTCScriptType.LegacyMultisig]: {
        public: 0x019da462,
        private: 0x019d9cfe,
      },
      [BTCScriptType.Legacy]: {
        public: 0x019da462,
        private: 0x019d9cfe,
      },
      [BTCScriptType.Segwit]: {
        public: 0x01b26ef6,
        private: 0x01b26792,
      },
      [BTCScriptType.SegwitNative]: bip32[BTCScriptType.SegwitNative],
    },
  },
  testnet: {
    messagePrefix: "\x18Bitcoin Signed Message:\n",
    bech32: "tb",
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef,
    bip32: {
      [BTCScriptType.LegacyMultisig]: {
        public: 0x043587cf,
        private: 0x04358394,
      },
      [BTCScriptType.Legacy]: {
        public: 0x043587cf,
        private: 0x04358394,
      },
      [BTCScriptType.Segwit]: {
        public: 0x044a5262,
        private: 0x044a4e28,
      },
      [BTCScriptType.SegwitNative]: {
        public: 0x045f1cf6,
        private: 0x045f18bc,
      },
    },
  },
};

//TODO: all below are missing network data
for (const coin of [
  "arkeo",
  "binance",
  "bitcoincash",
  "cardano",
  "cosmos",
  "ethereum",
  "kava",
  "mayachain",
  "osmosis",
  "secret",
  "terra",
  "thorchain",
])
  networks[coin] = networks.bitcoin;

export function getNetwork(coin: string, scriptType = BTCScriptType.Legacy): bitcoin.Network {
  coin = coin.toLowerCase();

  if (!(coin in networks)) throw new Error(`${coin} network not supported`);
  const network = networks[coin];

  const _bip32 = network.bip32[scriptType];
  if (!_bip32) throw new Error(`${scriptType} not supported for ${coin} network`);

  return { ...network, bip32: _bip32 };
}
