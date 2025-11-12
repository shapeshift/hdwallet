# Trezor Connect v8 to v9 Migration Research

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Trezor Connect v9 Changes](#trezor-connect-v9-changes)
4. [Reference Implementations](#reference-implementations)
5. [Technical Requirements](#technical-requirements)
6. [Known Issues & Workarounds](#known-issues--workarounds)
7. [Risk Assessment](#risk-assessment)
8. [Resources & References](#resources--references)

## Executive Summary

ShapeShift's Trezor implementation currently uses Trezor Connect v8, which was **deprecated and shut down in January 2024**. This document provides comprehensive research for migrating to Trezor Connect v9, adding modern features (Taproot, EIP-1559), and integrating Trezor support into the ShapeShift web application.

### Key Findings
- **Critical**: Trezor Connect v8 infrastructure is offline as of January 2024
- **Opportunity**: v9 brings Taproot support, improved TypeScript types, and better Suite integration
- **Complexity**: Medium-High due to 4-5 years of technical drift and lack of recent testing
- **Timeline**: 6-8 weeks for complete migration and web integration

## Current State Analysis

### HDWallet Monorepo Structure

#### Package: @shapeshiftoss/hdwallet-trezor (v1.62.3)
- **Purpose**: Core wallet implementation with chain-specific logic
- **Location**: `/packages/hdwallet-trezor/`
- **Key Files**:
  - `trezor.ts` (582 lines) - Main wallet class
  - `bitcoin.ts` (228 lines) - BTC operations
  - `ethereum.ts` (116 lines) - ETH operations
  - `transport.ts` - Abstract transport interface
  - `utils.ts` - Helper functions

**Current Features**:
- Bitcoin: BIP44/49/84 (Legacy, P2SH-Segwit, Native Segwit)
- Ethereum: Legacy transactions only
- Networks: ETH, AVAX, Arbitrum, ArbitrumNova, Base
- **Missing**: Taproot (BIP86), EIP-1559, Optimism, BSC, Polygon

#### Package: @shapeshiftoss/hdwallet-trezor-connect (v1.62.3)
- **Purpose**: Transport adapter using Trezor Connect library
- **Location**: `/packages/hdwallet-trezor-connect/`
- **Key Files**:
  - `adapter.ts` (195 lines) - Device lifecycle management
  - `transport.ts` (204 lines) - TrezorConnect wrapper
  - `modules.d.ts` - TypeScript declarations

**Current Dependencies**:
```json
{
  "trezor-connect": "^8.2.1",  // DEPRECATED!
  "@trezor/rollout": "^1.0.2"
}
```

### ShapeShift Web Application

**Critical Finding**: Trezor is NOT currently integrated into the web application
- No Trezor in `KeyManager` enum
- No Trezor packages in `package.json`
- No Trezor configuration in `SUPPORTED_WALLETS`
- Will require complete integration from scratch

### Testing Infrastructure

**Integration Tests**:
- Location: `/integration/src/wallets/trezor.ts`
- Uses mocked transport with pre-recorded responses
- No evidence of recent hardware testing
- Comprehensive test coverage for BTC/ETH operations

**Sandbox Application**:
- Location: `/examples/sandbox/`
- HTML-based testing interface
- Includes Trezor support
- Used for manual testing

## Trezor Connect v9 Changes

### Breaking Changes

#### Package Structure
```bash
# OLD (v8)
npm install trezor-connect

# NEW (v9)
npm install @trezor/connect-web  # For browsers
npm install @trezor/connect      # For Node.js
```

#### Required Manifest Changes
```typescript
// v8 (optional fields)
TrezorConnect.init({
  manifest: {
    email: 'developer@example.com',
    appUrl: 'https://example.com'
  }
})

// v9 (appName now required)
TrezorConnect.init({
  manifest: {
    email: 'developer@example.com',
    appUrl: 'https://example.com',
    appName: 'Your App Name'  // REQUIRED in v9.6.0+
  }
})
```

#### API Method Changes
- `rippleGetAccountInfo` + `ethereumGetAccountInfo` → `getAccountInfo`
- Cardano: `metadata` → `auxiliaryData`
- Stellar: `manageBuyOffer.buyAmount` → `amount`
- Various EOS parameter renames

#### Removed Features
- Legacy passphrase support (v9.4.0)
- DeviceModelInternal enum from exports (v9.5.2)
- Old Binance Beacon Chain support (v9.6.0)
- Deprecated coins: Dash, Bitcoin Gold, DigiByte, Namecoin, Vertcoin

### New Features in v9

#### Bitcoin Improvements
- **Taproot (BIP86/P2TR)** support with Schnorr signatures
- Lower minimum fee: 0.1 sat/vB (was 1.0)
- Two decimal places for fee precision
- No prevtx streaming for all-Taproot inputs

#### Ethereum Enhancements
- Full EIP-1559 support (maxFeePerGas, maxPriorityFeePerGas)
- 64-bit chain ID support
- MEV protection on ETH/Base/BNB
- Enhanced EIP-712 typed data signing

#### New Blockchain Support
- Solana with staking support
- Stellar
- Layer 2: Arbitrum One, Base, Optimism
- Any EVM chain via chainlist.org

#### Architecture Improvements
- Backend completely rewritten
- New `@trezor/blockchain-link` replaces bitcore
- Auto-generated TypeScript types from protobuf
- Improved popup handshake protocol
- Suite integration for desktop users

### Version Timeline
- v9.0.0 (2023) - Initial release with breaking changes
- v9.4.0 - Legacy passphrase removed
- v9.5.0 - ES2022 target required
- v9.6.0 (Aug 2024) - Suite integration, appName required
- v9.6.3 (Latest) - Current stable version

## Reference Implementations

### Frame Wallet (~/Sites/frame)

Frame successfully uses Trezor Connect v9.4.7 with excellent patterns:

#### Initialization
```typescript
// From main/signers/trezor/bridge.ts
const manifest = {
  email: 'dev@frame.sh',
  appUrl: 'https://frame.sh'
}

const config = {
  manifest,
  popup: false,        // Electron - no popup needed
  webusb: false,
  debug: false,
  lazyLoad: false,
  transports: ['NodeUsbTransport' as const]
}

await TrezorConnect.init(config)
```

#### Key Patterns to Adopt
1. **Concurrent Call Management**:
```typescript
static callInProgress: Promise<any> = Promise.resolve()

async call(method, params) {
  this.callInProgress = this.callInProgress.then(async () => {
    // Serialized execution
    const result = await TrezorConnect[method](params)
    await new Promise(r => setTimeout(r, 400)) // Delay for stability
    return result
  })
  return this.callInProgress
}
```

2. **Error Handling**:
```typescript
const errorCodes = {
  ADDRESS_NO_MATCH_DEVICE: 'Address doesn\'t match device',
  SAFETY_CHECKS: 'Forbidden derivation path',
  UNRECOVERABLE: 'Unrecoverable error'
}
```

3. **EIP-1559 Support**:
```typescript
// Handles both legacy and EIP-1559
const optionalFields = ['gasPrice', 'maxFeePerGas', 'maxPriorityFeePerGas']
```

### Brave Browser Migration

Brave's migration (PR #21861) shows minimal code changes:
```bash
# Simple package swap
npm uninstall trezor-connect
npm install @trezor/connect@9.1.11 --save-exact
npm install @trezor/connect-web@9.1.11 --save-exact
```

Only required updating imports - API remained compatible.

## Technical Requirements

### Firmware Requirements

#### Taproot Support
- Model T: Firmware 2.3.0+ (2021)
- Model One: Firmware 1.10.0+ (2021)
- Safe 3: Supported from launch

#### EIP-1559 Support
- Model T: Firmware 2.4.2+ (Sept 2021)
- Model One: Firmware 1.10.4+ (Dec 2021)

### Browser Requirements
- Chrome 89+ (WebUSB support)
- Firefox 87+ (with permissions)
- Edge 89+ (most reliable for popups)
- Safari 14.1+ (limited WebUSB)

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "ES2022",  // Required for v9.5.0+
    "module": "ESNext",
    "lib": ["ES2022", "DOM"]
  }
}
```

## Known Issues & Workarounds

### Critical Issues

#### 1. Popup Auto-Closing Bug
**Symptoms**:
- Popup window disappears after ~2 seconds
- Affects Chrome, Firefox intermittently
- 2+ year old issue, no permanent fix

**Workarounds**:
1. Recommend Microsoft Edge to users
2. Don't check "Remember this device"
3. Unlock device in Trezor Suite first (10min window)
4. Implement clear user guidance

#### 2. TrezorConnect Bug (#403)
**Issue**: Race condition after operations
**Workaround**: Add 1000ms delay after calls
```typescript
await TrezorConnect.someMethod(params)
await new Promise(resolve => setTimeout(resolve, 1000))
```

#### 3. PIN Length Limitation
**Issue**: PINs >9 digits not recognized
**Workaround**: Document limitation, suggest ≤9 digit PINs

#### 4. Concurrent Operations
**Issue**: TrezorConnect allows only one call at a time
**Solution**: Implement call serialization (see Frame's pattern)

### Migration-Specific Issues

#### TypeScript Types
- Auto-generated types may have different structure
- Some internal enums no longer exported
- Solution: Update type imports, use public APIs only

#### Event Constants
- Same names but different package
- Update imports to use `@trezor/connect-web`

## Risk Assessment

### High Risk
1. **Popup Issues** (2+ years unresolved)
   - Impact: Poor UX, user frustration
   - Mitigation: Documentation, browser recommendations

2. **Unknown Breaking Changes**
   - Impact: Runtime failures
   - Mitigation: Comprehensive testing, phased rollout

### Medium Risk
1. **Type Incompatibilities**
   - Impact: Build failures
   - Mitigation: TypeScript config updates

2. **Device Firmware Compatibility**
   - Impact: Feature unavailability
   - Mitigation: Version checks, graceful degradation

### Low Risk
1. **Bundle Size Increase**
   - Impact: Slower loads
   - Mitigation: Code splitting, lazy loading

2. **Browser Compatibility**
   - Impact: Limited user base
   - Mitigation: Browser detection, fallbacks

## Resources & References

### Official Documentation
- [Trezor Connect v9 API](https://connect.trezor.io/9/#/)
- [GitHub Repository](https://github.com/trezor/trezor-suite)
- [Migration Guide](https://github.com/trezor/trezor-suite/blob/develop/packages/connect/MIGRATION.md)
- [Examples](https://github.com/trezor/trezor-suite/tree/develop/packages/connect-examples)

### Community Resources
- [Trezor Forum](https://forum.trezor.io/)
- [Known Issues](https://github.com/trezor/trezor-suite/issues)
- [Frame Wallet Implementation](https://github.com/floating/frame)
- [Brave Migration PR](https://github.com/brave/brave-browser/pull/21861)

### Package Versions
- Latest Stable: `@trezor/connect-web@9.6.3`
- Frame Uses: `@trezor/connect@9.4.7`
- Brave Uses: `@trezor/connect@9.1.11`

### Testing Resources
- [Trezor Emulator](https://github.com/trezor/trezor-firmware/tree/master/core/emulator)
- [Connect Playground](https://connect.trezor.io/9/#/)
- [Device Bridge](https://github.com/trezor/trezord-go)

## Appendix: File Change Summary

### Files Requiring Updates

#### hdwallet-trezor-connect
- `package.json` - Update dependencies
- `src/adapter.ts` - Update imports, add appName
- `src/transport.ts` - Update imports, event handling
- `src/modules.d.ts` - Update type declarations

#### hdwallet-trezor (for new features)
- `src/bitcoin.ts` - Add Taproot support
- `src/ethereum.ts` - Confirm EIP-1559 works
- `src/trezor.ts` - Update supported networks

#### shapeshiftWeb (new integration)
- `src/context/WalletProvider/KeyManager.ts` - Add Trezor
- `src/context/WalletProvider/config.ts` - Add configuration
- `src/context/WalletProvider/Trezor/*` - New components
- `package.json` - Add Trezor packages
- `src/assets/translations/en/main.json` - Add strings

### Estimated Lines of Code
- Updates to existing: ~500 lines
- New code for web: ~1000 lines
- Tests: ~500 lines
- Total: ~2000 lines of changes