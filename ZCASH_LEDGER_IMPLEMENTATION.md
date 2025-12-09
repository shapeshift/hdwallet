# Zcash Ledger Support Implementation

## Overview
This document tracks the implementation of Zcash Ledger hardware wallet support in hdwallet, focusing on transparent address (t-address) transactions only.

## Current Status
**Version**: 1.62.24-ledger-zcash.24
**Status**: Implementing @bitgo/utxo-lib for proper Zcash v5 PSBT support

### Latest Progress (Dec 9, 2025)
- ✅ Switched to `@bitgo/utxo-lib` for Zcash Ledger (same approach as SwapKit)
- ✅ BlockHeight passed per input for correct consensus branch ID
- ✅ PSBT now creates Zcash v5 transactions (version `0x80000005`)
- ⏳ Fixing output script format (BitGo PSBT requires `{ script, value }` not `{ address, value }`)

### Debugging Tools
- **Blockchair API**: Used as monkey-patch for broadcast testing (provides specific errors like "Missing inputs" vs unchained's generic "5000ms timeout")
- **Transaction Analysis**: Comparing Native vs Ledger signed transactions byte-by-byte to identify differences

## Dependency Upgrade: @ledgerhq/hw-app-btc

**Upgraded**: `^10.10.0` → `^10.13.0`

**Why This Upgrade Was Necessary**:

The Zcash network activated the NU6.1 upgrade on November 24, 2025 at block 3,146,400, introducing a new consensus branch ID (`0x4DEC4DF0`). The older version of `@ledgerhq/hw-app-btc` (10.10.0) only knew about NU6 and earlier upgrades, causing it to sign transactions with the wrong branch ID.

**What Changed in hw-app-btc v10.12.0** (Released: Nov 5, 2025):
- **PR #12272**: Added "feat[zcash]: support nu6.1" by @Wozacosta
- **Commit**: [8a10c496](https://github.com/LedgerHQ/ledger-live/commit/8a10c49645bced4611808468bd2fc9132e7787ed) (Oct 13, 2025)
- **Release Date**: November 5, 2025 (19 days before NU6.1 mainnet activation)
- **Changes**:
  - Added `NU6_1: 3146400` constant to [`constants.ts`](https://github.com/LedgerHQ/ledger-live/blob/8a10c49645bced4611808468bd2fc9132e7787ed/libs/ledgerjs/packages/hw-app-btc/src/constants.ts)
  - Updated `getZcashBranchId()` function in [`createTransaction.ts`](https://github.com/LedgerHQ/ledger-live/blob/8a10c49645bced4611808468bd2fc9132e7787ed/libs/ledgerjs/packages/hw-app-btc/src/createTransaction.ts) to check NU6.1 activation
  - Function now correctly returns branch ID `0x4DEC4DF0` for expiry heights >= 3,146,400
  - Priority order: NU6.1 → NU6 → NU5 → Canopy → Heartwood → older upgrades

**Impact**:
Without this upgrade, all Zcash transactions would be signed with NU6 branch ID (`0xC8E71055`) and rejected by the network with error: `"transaction uses an incorrect consensus branch id"`.

**Timeline**:
- **Oct 13, 2025**: NU6.1 support code merged
- **Nov 5, 2025**: hw-app-btc v10.12.0 released
- **Nov 24, 2025**: NU6.1 activated on Zcash mainnet (block 3,146,400)
- **Dec 8, 2025**: hw-app-btc v10.13.0 released (current)

**References**:
- **Changelog**: https://github.com/LedgerHQ/ledger-live/blob/develop/libs/ledgerjs/packages/hw-app-btc/CHANGELOG.md (see v10.12.0)
- **NU6.1 commit**: https://github.com/LedgerHQ/ledger-live/commit/8a10c49645bced4611808468bd2fc9132e7787ed
- **Package versions**: [10.12.0](https://www.npmjs.com/package/@ledgerhq/hw-app-btc/v/10.12.0) | [10.13.0](https://www.npmjs.com/package/@ledgerhq/hw-app-btc/v/10.13.0)
- **ledger-live monorepo**: https://github.com/LedgerHQ/ledger-live

---

## Implementation Details

### 1. Supported Coins (`bitcoin.ts:16`)
Added "Zcash" to the `supportedCoins` array to enable Zcash through the Bitcoin/UTXO implementation path.

### 2. Network Configuration (`utils.ts:466-488`)
Uncommented and configured Zcash network parameters (SLIP44: 133):

```typescript
133: {
  name: "zcash",
  satoshi: 8,
  unit: "ZEC",
  apiName: "zec",
  appName: "Zcash",
  bitcoinjs: {
    messagePrefix: "Zcash Signed Message:",
    bip32: {
      public: { p2pkh: 76067358 },
      private: 87393172,
    },
    pubKeyHash: 0x1cb8,  // 7352 decimal
    scriptHash: 0x1cbd,  // 7357 decimal
    wif: 128,
  },
  isSegwitSupported: false,
  handleFeePerByte: false,
  areTransactionTimestamped: undefined,
  additionals: ["zcash", "sapling"],  // Critical for parsing v4/v5 transactions
}
```

### 3. App Name Mapping (`utils.ts:601`)
Added Zcash to the SLIP44-to-app-name mapping:
```typescript
133: "Zcash"
```

### 4. Currency Configuration (`currencies.ts:22-25`)
Added xpub version for Zcash:
```typescript
Zcash: {
  name: "Zcash",
  xpubVersion: 0x0488b21e,  // Same as Bitcoin
}
```

### 5. Transaction Signing - splitTransaction (`bitcoin.ts:263-270`)
**Critical Fix**: Pass all required parameters including `additionals` array:

```typescript
const tx = await transport.call(
  "Btc",
  "splitTransaction",
  msg.inputs[i].hex,
  msg.coin === "Zcash" ? true : networksUtil[slip44].isSegwitSupported,   // Must be true for Zcash
  msg.coin === "Zcash" ? true : networksUtil[slip44].areTransactionTimestamped,  // hasExtraData = true
  networksUtil[slip44].additionals || []  // ["zcash", "sapling"]
);
```

**Why this matters**: Without the `additionals: ["zcash", "sapling"]` parameter, the parser doesn't know to handle Zcash's Overwinter/Sapling transaction format, causing varint parsing errors.

### 6. Transaction Signing - createPaymentTransaction (`bitcoin.ts:287-303`)
Configured transaction args for Zcash:

```typescript
const txArgs: CreateTransactionArg = {
  inputs,
  associatedKeysets,
  outputScriptHex,
  additionals: (() => {
    if (msg.coin === "BitcoinCash") return ["abc"];
    if (msg.coin === "Zcash") return ["zcash", "sapling"];
    if (msg.inputs.some((input) => input.scriptType === core.BTCInputScriptType.SpendWitness))
      return ["bech32"];
    return [];
  })(),
  segwit,
  useTrustedInputForSegwit: Boolean(segwit),
  expiryHeight: msg.coin === "Zcash"
    ? (() => {
        const expiryBlock = 3146425;  // NU6.1 activation height + buffer
        const buffer = Buffer.alloc(4);
        buffer.writeUInt32LE(expiryBlock, 0);
        return buffer;
      })()
    : undefined,
};
```

---

## Technical Specifications

### BIP44 Derivation Path
- **SLIP44 Code**: 133
- **Standard Path**: `m/44'/133'/0'/0/x`
- **Account Type**: P2PKH (Legacy) only - no SegWit support

### Transaction Format
- **Versions**: v4 (Sapling), v5 (NU5+)
- **Version Encoding**: Little-endian with Overwinter flag
  - v4: `0x80000004`
  - v5: `0x80000005`
- **Version Group IDs**:
  - v4 (Sapling): `0x892F2085`
  - v5 (NU5+): `0x26A7270A`

### Consensus Branch IDs
- **NU5**: `0xC2D6D0B4` (block 1,687,104)
- **NU6**: `0xC8E71055` (block 2,726,400 - Nov 2024)
- **NU6.1**: `0x4DEC4DF0` (block 3,146,400 - Nov 2025)

### Address Format
- **Transparent addresses** (t-addresses): Start with "t1" (mainnet)
- **No shielded support**: z-addresses not supported in this implementation

---

## Issues & Solutions Discovered

### Issue 1: `getVarint called with unexpected parameters`
**Error**: `splitTransaction` failed with varint parsing error
**Root Cause**: Missing `additionals` parameter when calling `splitTransaction`
**Solution**: Pass `["zcash", "sapling"]` as 4th parameter
**Reference**: https://github.com/LedgerHQ/ledger-live/blob/develop/libs/ledgerjs/packages/hw-app-btc/tests/splitTransaction.test.ts

### Issue 2: Ledger App Quits / USB Transfer Cancelled
**Error**: `AbortError: Failed to execute 'transferIn' on 'USBDevice'`
**Root Cause**: Wrong `isSegwit` parameter value (was `false`, should be `true`)
**Solution**: Set 2nd parameter to `true` for Zcash in `splitTransaction`
**Reference**: Ledger test file shows `splitTransaction(hex, true, true, ["zcash", "sapling"])`

### Issue 3: Consensus Branch ID Mismatch (NU6 vs NU6.1)
**Error**: `transaction uses an incorrect consensus branch id`

**Root Cause**:
The Zcash network upgraded from NU6 to NU6.1 on November 24, 2025 at block 3,146,400. Each network upgrade has a unique consensus branch ID that must be included in transactions:

| Network Upgrade | Consensus Branch ID | Activation Block (Mainnet) | Date |
|---|---|---|---|
| NU5 | `0xC2D6D0B4` | 1,687,104 | May 2022 |
| NU6 | `0xC8E71055` | 2,726,400 | Nov 2024 |
| **NU6.1** | **`0x4DEC4DF0`** | **3,146,400** | **Nov 2025** |

**The Issue in Detail**:

1. **hw-app-btc v10.10.0** (old version):
   - Only knows about NU6 and earlier upgrades
   - Does NOT know about NU6.1
   - When given expiry height 3,146,425 (block after NU6.1 activation), it defaults to NU6 branch ID
   - Signed transaction contains: `0xC8E71055` (NU6)
   - Zcash network rejects it, expecting: `0x4DEC4DF0` (NU6.1)

2. **hw-app-btc v10.12.0+** (upgraded version):
   - Added NU6.1 support in PR #12272 (Oct 2025)
   - Updated `getZcashBranchId()` function to recognize NU6.1
   - Added constant `NU6_1: 3146400`
   - Correctly returns `0x4DEC4DF0` for heights >= 3,146,400

**Observable Evidence from Logs**:
```
serializedTxSample: "050000800a27a7265510e7c8..."
                              ^^^^^^^^
                              This is 0xC8E71055 (NU6) in little-endian
                              Should be 0xF04DEC4D for NU6.1
```

**Solution**:
- Upgrade `@ledgerhq/hw-app-btc` from `^10.10.0` to `^10.13.0`
- Set expiry height to valid block (3,146,425 = NU6.1 activation + 25)
- The upgraded library correctly maps this height → NU6.1 branch ID

**References**:
- **Native implementation**: [packages/hdwallet-native/src/bitcoin.ts:18](https://github.com/shapeshift/hdwallet/blob/develop/packages/hdwallet-native/src/bitcoin.ts#L18) - Uses `ZCASH_CONSENSUS_BRANCH_ID = 0x4dec4df0`
- **ZIP-255 (NU6.1 spec)**: https://zips.z.cash/zip-0255 - Defines consensus branch ID `0x4DEC4DF0`, activation at block 3,146,400
- **LedgerHQ commit adding NU6.1**: https://github.com/LedgerHQ/ledger-live/commit/8a10c49645bced4611808468bd2fc9132e7787ed
- **hw-app-btc changelog**: https://github.com/LedgerHQ/ledger-live/blob/develop/libs/ledgerjs/packages/hw-app-btc/CHANGELOG.md#version-10120

---

## Known Limitations

### 1. Transparent Addresses Only
- Only supports t-addresses (transparent UTXO transactions)
- Does **not** support z-addresses (shielded transactions)
- Shielded support would require Zondax's separate Zcash Shielded App

### 2. Expiry Height Management
- **Current**: Uses static block height `3200000` as temporary workaround
- **Issue**: Expiry height must be in the future (current block < expiry block)
- **Error if too low**: `"transaction must not be mined at a block Height(X) greater than its expiry Height(Y)"`
- **Zcash best practice**: expiry = current block + 25 blocks (~40 minutes)
- **TODO**:
  - Fetch current block height from unchained API
  - Calculate: `expiryBlock = currentBlock + 25`
  - Pass both `blockHeight` and `expiryHeight` with same value to ensure NU6.1 branch ID selection
- **Native wallet approach**: Receives `locktime` in message from chain adapter, doesn't calculate internally

### 3. Library Version Dependency
- **Upgraded**: `@ledgerhq/hw-app-btc` from `^10.10.0` to `10.13.0` (exact version, no caret)
- **Why Exact Version**: Prevent yarn from resolving to intermediate versions (e.g., 10.11.2) that lack NU6.1 support
- **What was happening**: `^10.10.0` resolved to 10.11.2, which only supported up to NU6
- **Confirmed via git diff**:
  - 10.11.2: `getZcashBranchId` defaults to NU6 (`0xc8e71055`)
  - 10.12.0+: `getZcashBranchId` defaults to NU6.1 (`0x4dec4df0`)
- **Additional safety**: Web's package.json includes resolution: `"@ledgerhq/hw-app-btc": "10.13.0"` to force version globally
- **See**: [Dependency Upgrade section](#dependency-upgrade-ledgerhqhw-app-btc) for full details

---

## Reference Documentation

### Official Zcash Specifications
- **ZIP-252**: Sapling deployment - https://zips.z.cash/zip-0252
- **ZIP-255**: NU6.1 deployment - https://zips.z.cash/zip-0255
- **ZIP-203**: Transaction expiry - https://zips.z.cash/zip-0203
- **Protocol Spec**: https://zips.z.cash/protocol/protocol.pdf

### Ledger Documentation
- **hw-app-btc README**: https://github.com/LedgerHQ/ledger-live/tree/develop/libs/ledgerjs/packages/hw-app-btc
- **splitTransaction tests**: https://github.com/LedgerHQ/ledger-live/blob/develop/libs/ledgerjs/packages/hw-app-btc/tests/splitTransaction.test.ts
- **Zcash support docs**: https://support.ledger.com/article/115005177269-zd
- **Zcash app repo**: https://github.com/Zondax/ledger-zcash

### Internal References
- **Native wallet implementation**: `packages/hdwallet-native/src/bitcoin.ts:13-18`
- **Bitcoin adapter pattern**: `packages/hdwallet-ledger/src/bitcoin.ts`

---

## Testing Checklist

- [x] Address derivation works (t-address format)
- [x] Transaction signing initiates
- [x] Ledger app stays open during signing
- [x] splitTransaction parses input transactions correctly
- [ ] Broadcast succeeds with correct consensus branch ID
- [ ] Simple send works end-to-end
- [ ] Swap works end-to-end
- [ ] Works on both mainnet and testnet

---

## Next Steps

1. **Verify consensus branch ID**: Check console logs to see which branch ID hw-app-btc is using
2. **Dynamic expiry height**: Implement proper block height fetching from unchained API
3. **Library version check**: Consider upgrading to hw-app-btc 10.13.0
4. **Remove debug logging**: Once working, remove console.log statements
5. **Add unit tests**: Test Zcash address derivation and transaction building

---

## Files Modified

| File | Lines | Changes |
|------|-------|---------|
| `packages/hdwallet-ledger/src/bitcoin.ts` | 16, 52-75, 147-153, 201-218, 231-270, 285-310 | Added Zcash support, logging, proper parameter passing |
| `packages/hdwallet-ledger/src/utils.ts` | 466-488, 601 | Uncommented Zcash network config, added app name mapping |
| `packages/hdwallet-ledger/src/currencies.ts` | 22-25 | Added Zcash currency with xpub version |

---

## Debugging

The implementation includes comprehensive console logging for debugging:
- `[Zcash Ledger] btcGetAddress` - Address derivation
- `[Zcash Ledger] btcSignTx` - Transaction signing initialization
- `[Zcash Ledger] Processing input X` - Input transaction parsing
- `[Zcash Ledger] Creating payment transaction` - Final transaction args

Check browser console for detailed parameter values at each step.
