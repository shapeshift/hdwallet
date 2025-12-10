# Zcash Ledger Implementation Guide

This document outlines the changes required to support Zcash (ZEC) on Ledger devices within `hdwallet`.

## Overview
Zcash support on Ledger requires specific handling due to its unique transaction format (ZIP-244, v4/v5 versions) and consensus branch IDs. The standard Bitcoin app on Ledger does not natively support these features without specific flags and updated libraries.

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
**Reference**: [Ledger splitTransaction tests](https://github.com/LedgerHQ/ledger-live/blob/develop/libs/ledgerjs/packages/hw-app-btc/tests/splitTransaction.test.ts)

### Issue 2: Ledger App Quits / USB Transfer Cancelled
**Error**: `AbortError: Failed to execute 'transferIn' on 'USBDevice'`
**Root Cause**: Wrong `isSegwit` parameter value (was `false`, should be `true`)
**Solution**: Set 2nd parameter to `true` for Zcash in `splitTransaction`
**Reference**: Ledger test file shows `splitTransaction(hex, true, true, ["zcash", "sapling"])`

### Issue 3: Consensus Branch ID Mismatch (NU6 vs NU6.1)
**Error**: `transaction uses an incorrect consensus branch id`
**Root Cause**: Zcash network upgraded to NU6.1 (0x4DEC4DF0), but older Ledger libraries defaulted to NU6.
**Solution**:
- Use `@ledgerhq/hw-app-btc` version `10.13.0` (strictly pinned across all packages)
- Explicitly set `consensusBranchId` in the adapter if necessary.

### Issue 4: Invalid Trusted Input Hash (Zcash v5)
**Error**: "Missing inputs" error or invalid signature verification on broadcast.
**Root Cause**: `@ledgerhq/hw-app-btc` uses Double-SHA256 (SHA256d) to calculate the transaction hash for trusted inputs. However, Zcash v5 transactions use ZIP-244 transaction digests (Tree Hash) for the TXID. The library fails to handle this correctly for Zcash inputs, resulting in a mismatch between the trusted input's TXID and the actual input being signed.
**Solution**: **Monkey Patch** implemented in `packages/hdwallet-ledger/src/bitcoin.ts`.
- **Mechanism**: We patch `getTrustedInputBIP143` to intercept Zcash transactions.
- **Fix**: The patch injects the correct ZIP-244 TXID (provided by the adapter via `_customZcashTxId`) and Amount, bypassing the library's faulty re-hashing logic.
- **Safety**: The patch is strictly guarded to only affect Zcash transactions with the custom properties attached. Trusted input security is maintained as the Ledger device still verifies the signature.
- **Implementation**: Uses `require` to modify the CommonJS exports of the library, as ES6 imports are immutable.

---

## Known Limitations

### 1. Transparent Addresses Only
- Only supports t-addresses (transparent UTXO transactions)
- Does **not** support z-addresses (shielded transactions)

### 2. Expiry Height Management
- **Current**: Hardcoded to 0 (no expiry) using `Buffer.alloc(4)` in the implementation.
- **Requirement**: Zcash transactions require `expiryHeight`. If 0, it means no expiry (valid per ZIP-203).
- **Note**: The current implementation does not derive expiry from input block height.

---

## Files Modified

| File | Changes |
|------|---------|
| `packages/hdwallet-ledger/src/bitcoin.ts` | **Major Update**: Added Monkey Patch for `getTrustedInputBIP143`. Logic for Zcash inputs (using `ZcashPsbt`, `splitTransaction` params). Constants for Version/Branch IDs. |
| `packages/hdwallet-ledger/src/utils.ts` | Configured `isSegwitSupported: true` and `areTransactionTimestamped: true` for Zcash (SLIP-133). |
| `packages/hdwallet-ledger/src/currencies.ts` | Added Zcash currency with xpub version. |

---

## Testing Checklist

- [x] Address derivation works (t-address format)
- [x] Transaction signing initiates
- [x] Ledger app stays open during signing
- [x] splitTransaction parses input transactions correctly
- [x] **Consensus Branch ID** matches NU6.1 (0x4DEC4DF0)
- [x] **Trusted Input Hashing** matches ZIP-244 (via Monkey Patch)
- [x] Broadcast succeeds (Simulated/Verified)
- [ ] Swap works end-to-end
