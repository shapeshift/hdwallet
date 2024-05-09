import type { AddressFormat } from "@ledgerhq/hw-app-btc";
import * as core from "@shapeshiftoss/hdwallet-core";
import bs58check from "bs58check";

import { LedgerResponse } from ".";
import { LedgerTransport } from "./transport";

export function handleError<T extends LedgerResponse<any, any>>(
  result: T,
  transport?: LedgerTransport,
  message?: string
): asserts result is T & { success: true } {
  if (result.success === true) return;

  if (result.payload && result.payload.error) {
    // No app selected
    if (result.payload.error.includes("0x6700") || result.payload.error.includes("0x6982")) {
      throw new core.SelectApp("Ledger", result.coin);
    }

    // Wrong app selected
    if (result.payload.error.includes("0x6d00")) {
      if (result.coin) {
        throw new core.WrongApp("Ledger", result.coin);
      }
      // Navigate to Ledger Dashboard
      throw new core.NavigateToDashboard("Ledger");
    }

    // User selected x instead of ✓
    if (result.payload.error.includes("0x6985")) {
      throw new core.ActionCancelled();
    }

    // Device is on the lock screen
    if (result.payload.error.includes("0x6f04")) {
      throw new core.DeviceLocked();
    }

    // Device disconnected during operation, typically due to app navigation
    if (result.payload.error.includes("DisconnectedDeviceDuringOperation")) {
      throw new core.DisconnectedDeviceDuringOperation();
    }

    if (transport) {
      transport.emit(
        `ledger.${result.coin}.${result.method}.call`,
        core.makeEvent({
          message_type: "ERROR",
          from_wallet: true,
          message,
        })
      );
    }

    throw new Error(`${message}: '${result.payload.error}'`);
  }
}

export function translateScriptType(scriptType: core.BTCInputScriptType): AddressFormat {
  const scriptTypeMap: Partial<Record<core.BTCInputScriptType, AddressFormat>> = {
    [core.BTCInputScriptType.SpendAddress]: "legacy",
    [core.BTCInputScriptType.CashAddr]: "cashaddr",
    [core.BTCInputScriptType.SpendWitness]: "bech32",
    [core.BTCInputScriptType.SpendP2SHWitness]: "p2sh",
  };
  return core.mustBeDefined(scriptTypeMap[scriptType]);
}

export const compressPublicKey = (publicKey: Uint8Array) => {
  if ([0x02, 0x03].includes(publicKey[0]) && publicKey.length === 33) return Buffer.from(publicKey);
  if (!(publicKey[0] === 0x04 && publicKey.length === 65)) throw new Error("Invalid public key format");

  return core.compatibleBufferConcat([
    Buffer.from([(publicKey[64] & 0x01) === 0x00 ? 0x02 : 0x03]),
    publicKey.slice(1, 33),
  ]);
};

export const createXpub = (
  depth: number,
  parentFp: number,
  childNum: number,
  chainCode: Uint8Array,
  publicKey: Uint8Array,
  network: number
) => {
  const header = new Uint8Array(4 + 1 + 4 + 4).buffer;
  const headerView = new DataView(header);
  headerView.setUint32(0, network);
  headerView.setUint8(4, depth);
  headerView.setUint32(5, parentFp);
  headerView.setUint32(9, childNum);
  return bs58check.encode(core.compatibleBufferConcat([new Uint8Array(header), chainCode, publicKey]));
};

type NetworkMagic = {
  bitcoinjs: {
    bip32: {
      public: Partial<Record<core.BTCInputScriptType, number>>;
    };
  };
  sigHash?: number;
  isSegwitSupported?: boolean;
  areTransactionTimestamped?: boolean;
};

export const networksUtil: Record<number, NetworkMagic> = {
  0: {
    bitcoinjs: {
      bip32: {
        public: {
          p2pkh: 76067358,
          p2sh: 77429938,
          p2wpkh: 78792518,
          "p2sh-p2wpkh": 77429938,
        },
      },
    },
    isSegwitSupported: true,
  },
  1: {
    bitcoinjs: {
      bip32: {
        public: {
          p2pkh: 76067358,
          p2sh: 71979618,
          p2wpkh: 73342198,
          "p2sh-p2wpkh": 71979618,
        },
      },
    },
    isSegwitSupported: true,
  },
  2: {
    isSegwitSupported: true,
    bitcoinjs: {
      bip32: {
        public: {
          p2pkh: 27108450,
        },
      },
    },
  },
  145: {
    bitcoinjs: {
      bip32: {
        public: {
          p2pkh: 76067358,
        },
      },
    },
    sigHash: 0x41,
    isSegwitSupported: true,
  },
  128: {
    bitcoinjs: {
      bip32: {
        public: {
          p2pkh: 76067358,
          p2sh: 77429938,
        },
      },
    },
    isSegwitSupported: true,
  },
  5: {
    bitcoinjs: {
      bip32: {
        public: {
          p2pkh: 50221772,
        },
      },
    },
    isSegwitSupported: false,
    areTransactionTimestamped: undefined,
  },
  6: {
    bitcoinjs: {
      bip32: {
        public: {
          p2pkh: 3874023909,
        },
      },
    },
    isSegwitSupported: false,
    areTransactionTimestamped: true,
  },
  14: {
    bitcoinjs: {
      bip32: {
        public: {
          p2pkh: 76067358,
        },
      },
    },
    isSegwitSupported: true,
    areTransactionTimestamped: false,
  },
  20: {
    bitcoinjs: {
      bip32: {
        public: {
          p2pkh: 76067358,
        },
      },
    },
    isSegwitSupported: true,
    areTransactionTimestamped: false,
  },
  47: {
    bitcoinjs: {
      bip32: {
        public: {
          p2pkh: 76067358,
        },
      },
    },
    isSegwitSupported: false,
    areTransactionTimestamped: true,
  },
  60: {
    bitcoinjs: {
      bip32: {
        public: {
          p2pkh: 76067358,
        },
      },
    },
  },
  77: {
    bitcoinjs: {
      bip32: {
        public: {
          p2pkh: 36513075,
        },
      },
    },
    isSegwitSupported: false,
    areTransactionTimestamped: false,
  },
  79: {
    bitcoinjs: {
      bip32: {
        public: {
          p2pkh: 76067358,
        },
      },
    },
    isSegwitSupported: false,
    areTransactionTimestamped: true,
  },
  88: {
    bitcoinjs: {
      bip32: {
        public: {
          p2pkh: 76067358,
          p2sh: 77429938,
          p2wpkh: 78792518,
        },
      },
    },
    isSegwitSupported: true,
    areTransactionTimestamped: undefined,
  },
  105: {
    bitcoinjs: {
      bip32: {
        public: {
          p2pkh: 76071454,
        },
      },
    },
    isSegwitSupported: false,
    areTransactionTimestamped: true,
  },
  125: {
    bitcoinjs: {
      bip32: {
        public: {
          p2pkh: 2405583718,
        },
      },
    },
    isSegwitSupported: false,
    areTransactionTimestamped: true,
  },
  // 133: {
  //   bitcoinjs: {
  //     bip32: {
  //       public: {
  //         p2pkh: 76067358
  //       },
  //     },
  //   },
  //   isSegwitSupported: false,
  //   areTransactionTimestamped: undefined,
  // },
  141: {
    bitcoinjs: {
      bip32: {
        public: {
          p2pkh: 4193182861,
        },
      },
    },
    isSegwitSupported: false,
    areTransactionTimestamped: undefined,
  },
  156: {
    bitcoinjs: {
      bip32: {
        public: {
          p2pkh: 76067358,
          p2sh: 77429938,
        },
      },
    },
    sigHash: 0x41,
    isSegwitSupported: true,
    areTransactionTimestamped: undefined,
  },
  171: {
    bitcoinjs: {
      bip32: {
        public: {
          p2pkh: 76071454,
        },
      },
    },
    isSegwitSupported: false,
    areTransactionTimestamped: true,
  },
  121: {
    bitcoinjs: {
      bip32: {
        public: {
          p2pkh: 76067358,
        },
      },
    },
  },
  3: {
    bitcoinjs: {
      bip32: {
        public: {
          p2pkh: 49990397,
        },
      },
    },
  },
};

const appNameBySlip44: Record<number, string> = {
  0: "Bitcoin",
  2: "Litecoin",
  3: "Dogecoin",
  5: "Dash",
  20: "Digibyte",
  60: "Ethereum",
  118: "Cosmos",
  145: "Bitcoin Cash",
  931: "THORChain",
};

export function coinToLedgerAppName(coin: core.Coin): string | undefined {
  const slip44 = core.mustBeDefined(core.slip44ByCoin(coin));
  return appNameBySlip44[slip44];
}

export const recursivelyOrderKeys = (unordered: any) => {
  // If it's an array - recursively order any
  // dictionary items within the array
  if (Array.isArray(unordered)) {
    unordered.forEach((item, index) => {
      unordered[index] = recursivelyOrderKeys(item);
    });
    return unordered;
  }

  // If it's an object - let's order the keys
  if (typeof unordered !== "object") return unordered;
  const ordered: any = {};
  Object.keys(unordered)
    .sort()
    .forEach((key) => (ordered[key] = recursivelyOrderKeys(unordered[key])));
  return ordered;
};

export const stringifyKeysInOrder = (data: any) => JSON.stringify(recursivelyOrderKeys(data));
