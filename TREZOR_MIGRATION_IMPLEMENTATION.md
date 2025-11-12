# Trezor Connect v8 to v9 Migration Implementation Plan

## Table of Contents
1. [Overview](#overview)
2. [Phase 1: Package Migration](#phase-1-package-migration)
3. [Phase 2: API Updates](#phase-2-api-updates)
4. [Phase 3: Modern Features](#phase-3-modern-features)
5. [Phase 4: Testing & Validation](#phase-4-testing--validation)
6. [Phase 5: Alpha Publishing](#phase-5-alpha-publishing)
7. [Phase 6: Web Integration](#phase-6-web-integration)
8. [Phase 7: Production Readiness](#phase-7-production-readiness)
9. [Rollback Plan](#rollback-plan)

## Overview

This document provides step-by-step implementation instructions for migrating ShapeShift's Trezor integration from Connect v8 to v9, adding modern features, and integrating into the web application.

### Success Criteria
- [ ] All existing Trezor operations work with v9
- [ ] Taproot address generation and signing work
- [ ] EIP-1559 transactions sign correctly
- [ ] Trezor appears in web wallet selection
- [ ] All tests pass
- [ ] No regression in existing functionality

### Timeline
- **Total Duration**: 6-8 weeks
- **Phase 1-2**: Week 1-2 (Core Migration)
- **Phase 3**: Week 3 (Modern Features)
- **Phase 4**: Week 4 (Testing)
- **Phase 5**: Week 5 (Alpha Publishing)
- **Phase 6**: Week 6-7 (Web Integration)
- **Phase 7**: Week 8 (Production Ready)

## Phase 1: Package Migration

### Step 1.1: Update Dependencies

**File**: `/packages/hdwallet-trezor-connect/package.json`

```json
{
  "dependencies": {
-   "trezor-connect": "^8.2.1",
+   "@trezor/connect": "^9.6.4",
    "@trezor/rollout": "^1.0.2"
  }
}
```

**Commands**:
```bash
cd packages/hdwallet-trezor-connect
yarn remove trezor-connect
yarn add @trezor/connect@^9.6.4
```

**Note**: `@trezor/connect` is the direct successor to `trezor-connect` and supports both Node.js and browser environments via separate entry points. Browser bundlers will automatically use the browser entry point.

### Step 1.2: Update Imports

**File**: `/packages/hdwallet-trezor-connect/src/adapter.ts`

```typescript
- import TrezorConnect, { DEVICE, DEVICE_EVENT, TRANSPORT_EVENT, UI } from "trezor-connect";
+ import TrezorConnect, { DEVICE, DEVICE_EVENT, TRANSPORT_EVENT, UI } from "@trezor/connect";
```

**File**: `/packages/hdwallet-trezor-connect/src/transport.ts`

```typescript
- import TrezorConnect, { DEVICE_EVENT, UI_EVENT } from "trezor-connect";
+ import TrezorConnect, { DEVICE_EVENT, UI_EVENT } from "@trezor/connect";
```

### Step 1.3: Update Type Declarations

**File**: `/packages/hdwallet-trezor-connect/src/modules.d.ts`

```typescript
- declare module "trezor-connect" {
+ declare module "@trezor/connect" {
  // Update any custom type extensions
}
```

### Step 1.4: Update Initialization

**File**: `/packages/hdwallet-trezor-connect/src/adapter.ts`

Find the `TrezorConnect.init` call and update:

```typescript
await TrezorConnect.init({
  ...args,
  manifest: {
    email: args.manifest?.email || "dev@shapeshift.com",
    appUrl: args.manifest?.appUrl || "https://app.shapeshift.com",
+   appName: args.manifest?.appName || "ShapeShift"  // REQUIRED in v9.6.0+
  },
  popup: true,
  lazyLoad: false,
});
```

### Step 1.5: Add Serialization Pattern

**File**: `/packages/hdwallet-trezor-connect/src/transport.ts`

Add Frame's proven concurrent call management:

```typescript
export class TrezorConnectTransport extends TrezorTransport {
  // Add call queue management
  private static callInProgress: Promise<any> = Promise.resolve();

  // Update the call method
  public async call(
    method: string,
    msg: any,
    msTimeout?: number,
    requireDeviceLabel: boolean = true
  ): Promise<any> {
    // Serialize calls to prevent race conditions
    TrezorConnectTransport.callInProgress = TrezorConnectTransport.callInProgress
      .then(async () => {
        const result = await this._call(method, msg, msTimeout, requireDeviceLabel);
        // Add delay to work around TrezorConnect bug #403
        await new Promise(resolve => setTimeout(resolve, 1000));
        return result;
      })
      .catch((error) => {
        // Don't break the chain on errors
        throw error;
      });

    return TrezorConnectTransport.callInProgress;
  }

  // Rename existing call to _call
  private async _call(
    method: string,
    msg: any,
    msTimeout?: number,
    requireDeviceLabel: boolean = true
  ): Promise<any> {
    // ... existing implementation
  }
}
```

## Phase 2: API Updates

### Step 2.1: Verify API Compatibility

Check each TrezorConnect method call for v9 compatibility:

**Methods to verify**:
- `TrezorConnect.getFeatures` ✓ (no change)
- `TrezorConnect.getAddress` ✓ (no change)
- `TrezorConnect.getPublicKey` ✓ (no change)
- `TrezorConnect.signTransaction` ✓ (no change)
- `TrezorConnect.ethereumGetAddress` ✓ (no change)
- `TrezorConnect.ethereumSignTransaction` ✓ (no change)
- `TrezorConnect.signMessage` ✓ (no change)
- `TrezorConnect.verifyMessage` ✓ (no change)
- `TrezorConnect.wipeDevice` ✓ (no change)
- `TrezorConnect.resetDevice` ✓ (no change)
- `TrezorConnect.loadDevice` ✓ (no change)
- `TrezorConnect.uiResponse` ✓ (no change)

### Step 2.2: Handle Breaking Changes

If using any deprecated methods:

```typescript
// OLD (v8)
- const info = await TrezorConnect.ethereumGetAccountInfo(params);
+ // NEW (v9) - merged method
+ const info = await TrezorConnect.getAccountInfo({ ...params, coin: 'eth' });
```

### Step 2.3: Update Error Handling

Add specific error handling for v9:

```typescript
// Handle new error codes
switch (error.code) {
  case 'Device_CallInProgress':
    // Retry after delay
    await new Promise(r => setTimeout(r, 400));
    return this.call(method, msg, msTimeout, requireDeviceLabel);

  case 'Popup_Closed':
    // User closed popup - expected behavior
    throw new Error('User cancelled the operation');

  default:
    throw error;
}
```

## Phase 3: Modern Features

### Step 3.1: Add Taproot Support

**File**: `/packages/hdwallet-core/src/bitcoin.ts`

```typescript
export enum BTCInputScriptType {
  SpendAddress = "p2pkh",
  SpendMultisig = "p2sh",
  SpendWitness = "p2wpkh",
  SpendP2SHWitness = "p2sh-p2wpkh",
+ SpendTaproot = "p2tr",  // BIP86 Taproot
}

export enum BTCOutputScriptType {
  PayToAddress = "p2pkh",
  PayToMultisig = "p2sh",
  PayToWitness = "p2wpkh",
  PayToP2SHWitness = "p2sh-p2wpkh",
+ PayToTaproot = "p2tr",  // BIP86 Taproot
}
```

**File**: `/packages/hdwallet-trezor/src/bitcoin.ts`

Add BIP86 path support:

```typescript
public btcGetAccountPaths(msg: BTCGetAccountPaths): Array<BTCAccountPath> {
  const paths: Array<BTCAccountPath> = [];

  // Existing BIP44/49/84 paths...

  // Add BIP86 (Taproot) path
  if (this.btcSupportsCoin(msg.coin) && this.btcSupportsScriptType(msg.coin, BTCInputScriptType.SpendTaproot)) {
    paths.push({
      coin: msg.coin,
      scriptType: BTCInputScriptType.SpendTaproot,
      addressNList: [0x80000000 + 86, 0x80000000 + slip44ByCoin(msg.coin), 0x80000000 + msg.accountIdx],
    });
  }

  return paths;
}

public btcSupportsScriptType(coin: Coin, scriptType?: BTCInputScriptType): boolean {
  switch (coin) {
    case Coin.Bitcoin:
    case Coin.BitcoinTestnet:
      // Bitcoin supports all script types including Taproot
      return true;
    // Other coins don't support Taproot yet
    default:
      if (scriptType === BTCInputScriptType.SpendTaproot) {
        return false;
      }
      return this._btcSupportsScriptType(coin, scriptType);
  }
}
```

**File**: `/packages/hdwallet-trezor/src/trezor.ts`

Update path description:

```typescript
public describeUTXOPath(path: BIP32Path, coin: Coin, scriptType?: BTCInputScriptType): PathDescription {
  // ... existing code ...

  switch (path[0]) {
    // ... existing cases ...

    case 0x80000000 + 86:
      purpose = "p2tr"; // Taproot
      break;
  }

  // ... rest of implementation
}
```

### Step 3.2: Verify EIP-1559 Support

**File**: `/packages/hdwallet-trezor/src/ethereum.ts`

```typescript
public ethSupportsEIP1559(): boolean {
- return false;
+ return true; // v9 supports EIP-1559
}

public async ethSignTx(msg: ETHSignTx): Promise<ETHSignedTx> {
  // Existing implementation should already handle EIP-1559 fields
  // Verify maxFeePerGas and maxPriorityFeePerGas are passed through

  const utx: EthereumTransaction = {
    to: msg.to,
    value: msg.value,
    data: msg.data || "",
    chainId: msg.chainId,
    nonce: msg.nonce,
    // v9 automatically handles these fields
    ...(msg.gasPrice && { gasPrice: msg.gasPrice }),
    ...(msg.maxFeePerGas && { maxFeePerGas: msg.maxFeePerGas }),
    ...(msg.maxPriorityFeePerGas && { maxPriorityFeePerGas: msg.maxPriorityFeePerGas }),
    gasLimit: msg.gasLimit,
  };

  // ... rest of implementation
}
```

## Phase 4: Testing & Validation

### Step 4.1: Update Integration Tests

**File**: `/integration/src/wallets/trezor.ts`

Update mocked responses if v9 changes response format:

```typescript
// Check if response format changed between v8 and v9
// Update mock responses accordingly
```

### Step 4.2: Build and Test Locally

```bash
# Build the packages (in hdwallet repo: https://github.com/shapeshift/hdwallet)
yarn
yarn build

# Run tests
yarn test

# Test in sandbox
cd examples/sandbox
yarn
yarn dev
# Open http://localhost:1234
# Test Trezor connection and operations
```

### Step 4.3: Manual Testing Checklist

#### Basic Operations
- [ ] Device connection
- [ ] Device disconnection
- [ ] PIN entry
- [ ] Passphrase entry
- [ ] Device wipe
- [ ] Device recovery

#### Bitcoin Operations
- [ ] BIP44 address generation (Legacy)
- [ ] BIP49 address generation (P2SH-SegWit)
- [ ] BIP84 address generation (Native SegWit)
- [ ] BIP86 address generation (Taproot) - NEW
- [ ] Sign Bitcoin transaction (all script types)
- [ ] Sign message
- [ ] Verify message

#### Ethereum Operations
- [ ] Address generation
- [ ] Legacy transaction signing
- [ ] EIP-1559 transaction signing
- [ ] Message signing
- [ ] Typed data signing (EIP-712)

#### Error Scenarios
- [ ] User cancels operation
- [ ] Device disconnected during operation
- [ ] Wrong PIN entered
- [ ] Popup blocked by browser
- [ ] Concurrent operations

### Step 4.4: Browser Testing

Test in multiple browsers:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Edge (latest) - Best for popup issues
- [ ] Safari (if supporting Mac users)

## Phase 5: Alpha Publishing

### Step 5.1: Version Bump

```bash
# In hdwallet repo: https://github.com/shapeshift/hdwallet

# Check current version
yarn lerna list --json | jq '.[0].version'
# Example: 1.62.3

# Bump to alpha
yarn lerna version 1.62.4-alpha.trezor.1 --no-git-tag-version --no-push
```

### Step 5.2: Build and Publish

```bash
# Clean build
yarn clean
yarn
yarn build

# Publish to npm with alpha tag
npx lerna publish from-package --no-git-tag-version --no-push --yes
```

### Step 5.3: Test Alpha in Web

```bash
# In web repo

# Update all hdwallet packages to new alpha
yarn up @shapeshiftoss/hdwallet-*@1.62.4-alpha.trezor.1

# Install and test
yarn
yarn dev
```

### Step 5.4: Iterate on Alpha

If issues found:
1. Fix in hdwallet repo
2. Bump version (e.g., 1.62.4-alpha.trezor.2)
3. Build and publish
4. Update web repo
5. Repeat until stable

## Phase 6: Web Integration

### Step 6.1: Add Trezor to KeyManager

**File**: `/src/context/WalletProvider/KeyManager.ts` (in web repo)

```typescript
export enum KeyManager {
  Mobile = 'mobile',
  Native = 'native',
  // ... other wallets ...
  Ledger = 'ledger',
+ Trezor = 'trezor',
}
```

### Step 6.2: Create Trezor Configuration

**File**: `/src/context/WalletProvider/Trezor/config.ts` (in web repo)

```typescript
import { TrezorAdapter } from '@shapeshiftoss/hdwallet-trezor-connect'
import { TrezorIcon } from 'components/Icons/TrezorIcon'

export const TrezorConfig = {
  adapter: TrezorAdapter,
  icon: TrezorIcon,
  name: 'Trezor',
  supportedChains: [
    // List supported chains
    ChainId.Ethereum,
    ChainId.Bitcoin,
    ChainId.Avalanche,
    // ... etc
  ],
  routes: [
    {
      path: '/trezor/connect',
      component: lazy(() => import('./components/Connect')),
    },
    {
      path: '/trezor/success',
      component: lazy(() => import('./components/Success')),
    },
    {
      path: '/trezor/failure',
      component: lazy(() => import('./components/Failure')),
    },
  ],
}
```

### Step 6.3: Create Connection Components

**File**: `/src/context/WalletProvider/Trezor/components/Connect.tsx` (in web repo)

```typescript
import { useState } from 'react'
import { useHistory } from 'react-router-dom'
import { Button, Text, VStack } from '@chakra-ui/react'
import { TrezorAdapter } from '@shapeshiftoss/hdwallet-trezor-connect'
import { useWallet } from 'hooks/useWallet/useWallet'

export const TrezorConnect = () => {
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const history = useHistory()
  const { connect } = useWallet()

  const handleConnect = async () => {
    setIsConnecting(true)
    setError(null)

    try {
      const adapter = new TrezorAdapter({
        manifest: {
          email: 'dev@shapeshift.com',
          appUrl: 'https://app.shapeshift.com',
          appName: 'ShapeShift'
        }
      })

      const wallet = await adapter.pairDevice()
      if (wallet) {
        await connect(wallet)
        history.push('/trezor/success')
      }
    } catch (err) {
      setError(err.message)
      history.push('/trezor/failure')
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <VStack spacing={4}>
      <Text>Connect your Trezor device</Text>
      <Button
        onClick={handleConnect}
        isLoading={isConnecting}
        loadingText="Connecting..."
      >
        Connect Trezor
      </Button>
      {error && <Text color="red.500">{error}</Text>}
    </VStack>
  )
}
```

### Step 6.4: Add to Supported Wallets

**File**: `/src/context/WalletProvider/config.ts` (in web repo)

```typescript
import { TrezorConfig } from './Trezor/config'

export const SUPPORTED_WALLETS = {
  // ... existing wallets ...
+ [KeyManager.Trezor]: TrezorConfig,
}
```

### Step 6.5: Add Translations

**File**: `/src/assets/translations/en/main.json` (in web repo)

```json
{
  "wallets": {
    "trezor": {
      "name": "Trezor",
      "connect": "Connect Trezor",
      "connecting": "Connecting to Trezor...",
      "success": "Trezor connected successfully",
      "failure": "Failed to connect Trezor",
      "errors": {
        "popupBlocked": "Please allow popups for Trezor Connect",
        "cancelled": "Connection cancelled by user",
        "deviceNotFound": "No Trezor device found",
        "pinInvalid": "Invalid PIN entered"
      }
    }
  }
}
```

### Step 6.6: Update Package.json

**File**: `/package.json` (in web repo)

```json
{
  "dependencies": {
    // ... existing dependencies ...
+   "@shapeshiftoss/hdwallet-trezor": "1.62.4-alpha.trezor.1",
+   "@shapeshiftoss/hdwallet-trezor-connect": "1.62.4-alpha.trezor.1",
  }
}
```

## Phase 7: Production Readiness

### Step 7.1: Performance Testing

```bash
# Measure bundle size impact
yarn build
yarn analyze

# Check for performance regressions
# Test connection time
# Test transaction signing speed
```

### Step 7.2: Security Review

- [ ] Review all user inputs
- [ ] Verify no secrets in logs
- [ ] Check CSP headers for popup
- [ ] Verify origin validation

### Step 7.3: Documentation

Create user documentation:
- How to connect Trezor
- Supported features
- Troubleshooting guide
- Known issues (popup problems)

### Step 7.4: Feature Flag (Optional)

```typescript
// Add feature flag for gradual rollout
export const TREZOR_ENABLED = getConfig().VITE_FEATURE_TREZOR

// Use in wallet selection
{TREZOR_ENABLED && (
  <WalletOption wallet={KeyManager.Trezor} />
)}
```

### Step 7.5: Final Testing

- [ ] Full end-to-end test on staging
- [ ] Test with real hardware devices
- [ ] Test all supported chains
- [ ] Verify analytics/telemetry
- [ ] Load testing

### Step 7.6: Release

```bash
# Tag final version (in hdwallet repo: https://github.com/shapeshift/hdwallet)
yarn lerna version 1.62.4 --no-git-tag-version --no-push

# Publish production version
npx lerna publish from-package --no-git-tag-version --no-push --yes

# Update web to production version (in web repo)
yarn up @shapeshiftoss/hdwallet-*@1.62.4
```

## Rollback Plan

### If Critical Issues Found

1. **Immediate Rollback**:
```bash
# In web repo
yarn up @shapeshiftoss/hdwallet-*@1.62.3
yarn build
# Deploy
```

2. **Feature Flag Disable**:
```typescript
// Set in .env
VITE_FEATURE_TREZOR=false
```

3. **Communication**:
- Update status page
- Notify affected users
- Document issues for fix

### Recovery Steps

1. Identify root cause
2. Fix in hdwallet repo
3. Extensive testing
4. Gradual re-rollout
5. Monitor metrics

## Appendix: Common Issues & Solutions

### Issue: Popup Auto-Closes
**Solution**:
- Recommend Edge browser
- Don't check "Remember device"
- Provide clear user instructions

### Issue: Concurrent Call Errors
**Solution**:
- Implement call serialization
- Add delays between calls

### Issue: TypeScript Errors
**Solution**:
- Update tsconfig target to ES2022
- Use proper type imports from v9

### Issue: Device Not Recognized
**Solution**:
- Check firmware version
- Verify USB connection
- Try different USB port/cable

### Issue: PIN Too Long
**Solution**:
- Document 9-digit limitation
- Suggest PIN change

## Testing Commands Reference

```bash
# Build everything
yarn && yarn build

# Run tests
yarn test

# Test specific package
yarn workspace @shapeshiftoss/hdwallet-trezor test

# Run sandbox
cd examples/sandbox && yarn dev

# Check types
yarn type-check

# Lint
yarn lint

# Clean build
yarn clean && yarn && yarn build

# Publish alpha
npx lerna publish from-package --no-git-tag-version --no-push --yes

# Update web packages
yarn up @shapeshiftoss/hdwallet-*@VERSION
```

## Success Metrics

- Zero regression in existing functionality
- <3s connection time
- <2s transaction signing
- <5% increase in bundle size
- Zero critical bugs in production
- >95% success rate for connections

## Contact & Support

- GitHub Issues: [hdwallet repo](https://github.com/shapeshift/hdwallet)
- Trezor Support: [forum.trezor.io](https://forum.trezor.io)
- Internal: #engineering channel

---

**Document Version**: 1.0.0
**Last Updated**: November 2024
**Author**: ShapeShift Engineering