import { Network } from "bitcoinjs-lib";

type BIP32 = {
  bip32: {
    public: number;
    private: number;
  };
};

type BIP32ByScriptType = {
  p2sh: BIP32;
  p2pkh: BIP32;
  "p2sh-p2wpkh"?: BIP32;
  p2wpkh?: BIP32;
};

const bip32BTC: BIP32ByScriptType = {
  p2sh: {
    bip32: {
      public: 0x0488b21e,
      private: 0x0488ade4,
    },
  },
  p2pkh: {
    bip32: {
      public: 0x0488b21e,
      private: 0x0488ade4,
    },
  },
  "p2sh-p2wpkh": {
    bip32: {
      public: 0x049d7cb2,
      private: 0x049d7878,
    },
  },
  p2wpkh: {
    bip32: {
      public: 0x04b24746,
      private: 0x04b2430c,
    },
  },
};

type NetworkDescription = {
  base: Omit<Network, "bip32">;
} & BIP32ByScriptType;

type Networks = {
  [k: string]: NetworkDescription;
};

const networks: Networks = {
  bitcoin: {
    base: {
      messagePrefix: "\x18Bitcoin Signed Message:\n",
      bech32: "bc",
      pubKeyHash: 0x00,
      scriptHash: 0x05,
      wif: 0x80,
    },
    ...bip32BTC,
  },
  dash: {
    base: {
      messagePrefix: "unused",
      bech32: "",
      pubKeyHash: 0x4c,
      scriptHash: 0x10,
      wif: 0xcc,
    },
    p2sh: bip32BTC.p2sh,
    p2pkh: bip32BTC.p2pkh,
  },
  digibyte: {
    base: {
      messagePrefix: "\x19Digibyte Signed Message:\n",
      bech32: "dgb",
      pubKeyHash: 0x1e,
      scriptHash: 0x3f,
      wif: 0x80,
    },
    ...bip32BTC,
  },
  dogecoin: {
    base: {
      messagePrefix: "\x19Dogecoin Signed Message:\n",
      bech32: "",
      pubKeyHash: 0x1e,
      scriptHash: 0x16,
      wif: 0x9e,
    },
    p2sh: {
      bip32: {
        public: 0x02facafd,
        private: 0x02fac398,
      },
    },
    p2pkh: {
      bip32: {
        public: 0x02facafd,
        private: 0x02fac398,
      },
    },
  },
  litecoin: {
    base: {
      messagePrefix: "\x19Litecoin Signed Message:\n",
      bech32: "ltc",
      pubKeyHash: 0x30,
      scriptHash: 0x32,
      wif: 0xb0,
    },
    p2sh: {
      bip32: {
        public: 0x019da462,
        private: 0x019d9cfe,
      },
    },
    p2pkh: {
      bip32: {
        public: 0x019da462,
        private: 0x019d9cfe,
      },
    },
    "p2sh-p2wpkh": {
      bip32: {
        public: 0x01b26ef6,
        private: 0x01b26792,
      },
    },
    p2wpkh: {
      bip32: {
        public: 0x0488b21e,
        private: 0x0488ade4,
      },
    },
  },
};

export function getNetwork(coin: string, scriptType?: string): Network {
  let network: NetworkDescription;
  switch (coin) {
    case "Dash":
    case "Digibyte":
    case "Dogecoin":
    case "Litecoin":
      network = networks[coin.toLowerCase()];
      break;
    case "Bitcoin":
    case "Ethereum":
      network = networks["bitcoin"];
      break;
    default:
      throw new Error(`${coin} network not supported`);
  }

  const bip32 = network[scriptType || "p2sh"];

  if (!bip32) {
    throw new Error(`${scriptType} not supported for ${coin} network`);
  }

  return {
    ...network.base,
    ...bip32,
  };
}
