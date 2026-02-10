import type {
  BIP32Path,
  DescribePath,
  GetPublicKey,
  HDWallet,
  NearAccountPath,
  NearGetAccountPaths,
  NearGetAddress,
  NearSignedTx,
  NearSignTx,
  PathDescription,
  Ping,
  Pong,
  PublicKey,
  SolanaAccountPath,
  SolanaGetAccountPaths,
  SolanaGetAddress,
  SolanaSignedTx,
  SolanaSignTx,
  SolanaTxSignature,
  SuiAccountPath,
  SuiGetAccountPaths,
  SuiGetAddress,
  SuiSignedTx,
  SuiSignTx,
  TonAccountPath,
  TonGetAccountPaths,
  TonGetAddress,
  TonSignedTx,
  TonSignTx,
} from '@shapeshiftoss/hdwallet-core'
import {
  nearGetAccountPaths,
  nearAddressNListToBIP32,
  solanaBuildTransaction,
  suiGetAccountPaths,
  tonGetAccountPaths,
  addressNListToBIP32,
} from '@shapeshiftoss/hdwallet-core'
import { PublicKey as SolanaPublicKey } from '@solana/web3.js'
import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519'
import type { MessageRelaxed } from '@ton/core'
import { Address, beginCell, Cell, internal, SendMode, storeMessage } from '@ton/core'
import { WalletContractV4 } from '@ton/ton'
import { createBLAKE2b } from 'hash-wasm'
import nacl from 'tweetnacl'

import type { SeekerMessageHandler } from './types'

export class SeekerHDWallet implements HDWallet {
  private deviceId: string
  private pubkey: string
  private messageHandler: SeekerMessageHandler
  // Cache version to invalidate old entries when derivation paths change
  private static readonly CACHE_VERSION = 'v2'
  private nearPubkeyCache: Map<string, string> = new Map()
  private suiPubkeyCache: Map<string, string> = new Map()
  private tonPubkeyCache: Map<string, string> = new Map()

  readonly _supportsSolana = true
  readonly _supportsSolanaInfo = true
  // NEAR support: Experimental - requestPublicKey may not be fully supported by all MWA implementations
  // See SeekerWalletManager.getPublicKey() for implementation details
  readonly _supportsNear = true
  readonly _supportsNearInfo = true
  readonly _supportsSui = true
  readonly _supportsSuiInfo = true
  readonly _supportsTon = true
  readonly _supportsTonInfo = true

  constructor(deviceId: string, pubkey: string, messageHandler: SeekerMessageHandler) {
    this.deviceId = deviceId
    this.pubkey = pubkey
    this.messageHandler = messageHandler
  }

  getVendor(): string {
    return 'Seeker'
  }

  hasOnDevicePinEntry(): boolean {
    return false
  }

  hasOnDevicePassphrase(): boolean {
    return false
  }

  hasOnDeviceDisplay(): boolean {
    return true
  }

  hasOnDeviceRecovery(): boolean {
    return true
  }

  hasNativeShapeShift(): boolean {
    return false
  }

  supportsBip44Accounts(): boolean {
    return false
  }

  supportsOfflineSigning(): boolean {
    return false
  }

  supportsBroadcast(): boolean {
    return true
  }

  describePath(_msg: DescribePath): PathDescription {
    return {
      isKnown: false,
      verbose: 'Seeker Solana',
      coin: 'Solana',
    }
  }

  getDeviceID(): Promise<string> {
    return Promise.resolve(this.deviceId)
  }

  getFeatures(): Promise<Record<string, unknown>> {
    return Promise.resolve({
      vendor: 'Seeker',
      model: 'Seeker',
      label: 'Seeker Wallet',
    })
  }

  getFirmwareVersion(): Promise<string> {
    return Promise.resolve('1.0.0')
  }

  getModel(): Promise<string> {
    return Promise.resolve('Seeker')
  }

  getLabel(): Promise<string> {
    return Promise.resolve('Seeker Wallet')
  }

  getPublicKeys(_msg: GetPublicKey[]): Promise<(PublicKey | null)[] | null> {
    return Promise.resolve([{ xpub: this.pubkey }])
  }

  isInitialized(): Promise<boolean> {
    return Promise.resolve(true)
  }

  isLocked(): Promise<boolean> {
    return Promise.resolve(false)
  }

  clearSession(): Promise<void> {
    return Promise.resolve()
  }

  initialize(): Promise<void> {
    return Promise.resolve()
  }

  ping(_msg: Ping): Promise<Pong> {
    return Promise.resolve({ msg: 'pong' })
  }

  sendPin(_pin: string): Promise<void> {
    return Promise.resolve()
  }

  sendPassphrase(_passphrase: string): Promise<void> {
    return Promise.resolve()
  }

  sendCharacter(_character: string): Promise<void> {
    return Promise.resolve()
  }

  sendWord(_word: string): Promise<void> {
    return Promise.resolve()
  }

  cancel(): Promise<void> {
    return Promise.resolve()
  }

  wipe(): Promise<void> {
    return Promise.resolve()
  }

  reset(): Promise<void> {
    return Promise.resolve()
  }

  recover(): Promise<void> {
    return Promise.resolve()
  }

  loadDevice(): Promise<void> {
    return Promise.resolve()
  }

  disconnect(): Promise<void> {
    return Promise.resolve()
  }

  getAddress(): string {
    return this.pubkey
  }

  solanaGetAddress(_msg: SolanaGetAddress): Promise<string | null> {
    return Promise.resolve(this.pubkey)
  }

  solanaGetAccountPaths(msg: SolanaGetAccountPaths): SolanaAccountPath[] {
    // Solana Mobile Seed Vault uses 4-level paths: m/44'/501'/<account>'/0'
    const slip44 = 501 // Solana
    return [
      {
        addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0x80000000 + 0],
      },
    ]
  }

  solanaNextAccountPath(_msg: SolanaAccountPath): SolanaAccountPath | undefined {
    return undefined
  }

  async solanaSignTx(msg: SolanaSignTx): Promise<SolanaSignedTx | null> {
    const transaction = solanaBuildTransaction(msg, this.pubkey)
    const serializedTx = Buffer.from(transaction.serialize()).toString('base64')

    const result = await this.messageHandler.signTransaction(serializedTx)
    if (!result.success || !result.signedTransaction) {
      throw new Error(result.error ?? 'Failed to sign transaction')
    }

    return {
      serialized: result.signedTransaction,
      signatures: [result.signedTransaction],
    }
  }

  async solanaSendTx(msg: SolanaSignTx): Promise<SolanaTxSignature | null> {
    const transaction = solanaBuildTransaction(msg, this.pubkey)
    const serializedTx = Buffer.from(transaction.serialize()).toString('base64')

    const result = await this.messageHandler.signAndSendTransaction(serializedTx)
    if (!result.success || !result.signature) {
      throw new Error(result.error ?? 'Failed to sign and send transaction')
    }

    return { signature: result.signature }
  }

  // NEAR Protocol support
  async nearGetAddress(msg: NearGetAddress): Promise<string | null> {
    // NEAR uses a different derivation path than Solana
    // Convert the addressNList to BIP32 URI format (e.g., "bip32:/m/44'/397'/0'")
    try {
      const derivationPath = 'bip32:/' + nearAddressNListToBIP32(msg.addressNList)
      const cacheKey = `${SeekerHDWallet.CACHE_VERSION}:${derivationPath}`
      console.log('[SeekerHDWallet] NEAR - Requested derivation path:', derivationPath)
      console.log('[SeekerHDWallet] NEAR - Cache key:', cacheKey)
      console.log('[SeekerHDWallet] NEAR - Cache contents:', Array.from(this.nearPubkeyCache.entries()))

      // Check cache first
      const cachedPubkey = this.nearPubkeyCache.get(cacheKey)
      if (cachedPubkey) {
        console.log('[SeekerHDWallet] NEAR - Using cached public key:', cachedPubkey)
        const publicKey = new SolanaPublicKey(cachedPubkey)
        const hexPublicKey = Buffer.from(publicKey.toBytes()).toString('hex')
        console.log('[SeekerHDWallet] NEAR - Returning cached hex address:', hexPublicKey)
        return hexPublicKey
      }

      // Request NEAR public key using BIP32 URI format
      const result = await this.messageHandler.getPublicKey(derivationPath)
      if (!result.publicKey) {
        throw new Error('Failed to get NEAR public key from Seed Vault')
      }

      // Cache the base58-encoded public key for this derivation path
      this.nearPubkeyCache.set(cacheKey, result.publicKey)

      // Convert base58 public key to hex format for NEAR implicit accounts
      const publicKey = new SolanaPublicKey(result.publicKey)
      const hexPublicKey = Buffer.from(publicKey.toBytes()).toString('hex')
      console.log('[SeekerHDWallet] NEAR address retrieved for', derivationPath, '- pubkey:', result.publicKey, '- hex:', hexPublicKey)
      return hexPublicKey
    } catch (error) {
      console.error('Error getting NEAR address from Seed Vault:', error)
      return null
    }
  }

  nearGetAccountPaths(msg: NearGetAccountPaths): NearAccountPath[] {
    // Try 4-level path with account at level 2: m/44'/397'/<account>'/0'
    const slip44 = 397 // NEAR
    return [
      {
        addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0x80000000 + 0],
      },
    ]
  }

  nearNextAccountPath(msg: NearAccountPath): NearAccountPath | undefined {
    const addressNList = msg.addressNList
    if (!addressNList || addressNList.length < 3) return undefined

    const accountIdx = (addressNList[2] & 0x7fffffff)

    // TEMPORARY: Only support account #0 until we verify derivation works properly
    // Once we confirm different derivation paths return different addresses from Seed Vault,
    // we can enable multi-account support
    if (accountIdx >= 0) {
      console.log('[SeekerHDWallet] NEAR account discovery stopped - only supporting account #0 until derivation verified')
      return undefined
    }

    const nextAccountIdx = accountIdx + 1
    return {
      addressNList: [0x80000000 + 44, 0x80000000 + 397, 0x80000000 + nextAccountIdx],
    }
  }

  async nearSignTx(msg: NearSignTx): Promise<NearSignedTx | null> {
    // NEAR transactions need to be hashed before signing
    // The Borsh-serialized transaction bytes are in msg.txBytes
    const crypto = await import('crypto')
    const txHash = crypto.createHash('sha256').update(Buffer.from(msg.txBytes)).digest()
    const txHashBase64 = txHash.toString('base64')

    // Convert the addressNList to BIP32 URI format (e.g., "bip32:/m/44'/397'/0'")
    const derivationPath = 'bip32:/' + nearAddressNListToBIP32(msg.addressNList)

    console.log('[SeekerHDWallet] Signing NEAR tx with path:', derivationPath, 'hash length:', txHash.length)
    const result = await this.messageHandler.signMessage(txHashBase64, derivationPath)
    if (!result.signature) {
      throw new Error('Failed to sign NEAR transaction')
    }

    // The signature from Seed Vault is base64-encoded Ed25519 signature bytes
    const signatureBytes = Buffer.from(result.signature, 'base64')
    const signature = signatureBytes.toString('hex')

    // Get the public key for this derivation path
    const cachedPubkey = this.nearPubkeyCache.get(derivationPath) || this.pubkey

    console.log('[SeekerHDWallet] NEAR tx signed, signature length:', signatureBytes.length)
    console.log('[SeekerHDWallet] NEAR signature type:', typeof signature, 'value:', signature.substring(0, 20) + '...')
    console.log('[SeekerHDWallet] NEAR publicKey type:', typeof cachedPubkey, 'value:', cachedPubkey)
    const returnValue = {
      signature,
      publicKey: cachedPubkey,
    }
    console.log('[SeekerHDWallet] NEAR nearSignTx returning:', JSON.stringify(returnValue).substring(0, 100) + '...')
    return returnValue
  }

  // SUI Protocol support
  suiGetAccountPaths(msg: SuiGetAccountPaths): SuiAccountPath[] {
    // Solana Mobile Seed Vault uses 4-level paths for all chains (matching Solana structure)
    // m/44'/784'/<account>'/0' instead of standard 5-level m/44'/784'/<account>'/0'/0'
    const slip44 = 784 // SUI
    return [
      {
        addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0x80000000 + 0],
      },
    ]
  }

  suiNextAccountPath(_msg: SuiAccountPath): SuiAccountPath | undefined {
    // Only support account #0, same as NEAR until multi-chain derivation is verified
    return undefined
  }

  async suiGetAddress(msg: SuiGetAddress): Promise<string | null> {
    // SUI uses derivation path m/44'/784'/x'/0'/0' (all hardened)
    try {
      const derivationPath = 'bip32:/' + addressNListToBIP32(msg.addressNList)
      const cacheKey = `${SeekerHDWallet.CACHE_VERSION}:${derivationPath}`
      console.log('[SeekerHDWallet] SUI - Requested derivation path:', derivationPath)
      console.log('[SeekerHDWallet] SUI - Cache key:', cacheKey)
      console.log('[SeekerHDWallet] SUI - Cache contents:', Array.from(this.suiPubkeyCache.entries()))

      // Check cache first
      const cachedPubkey = this.suiPubkeyCache.get(cacheKey)
      if (cachedPubkey) {
        console.log('[SeekerHDWallet] SUI - Using cached public key:', cachedPubkey)
        const publicKey = new SolanaPublicKey(cachedPubkey)
        const pubkeyBytes = Buffer.from(publicKey.toBytes())
        const hexPubKey = pubkeyBytes.toString('hex')
        console.log('[SeekerHDWallet] SUI - Public key hex:', hexPubKey)
        const suiPublicKey = new Ed25519PublicKey(pubkeyBytes)
        const suiAddress = suiPublicKey.toSuiAddress()
        console.log('[SeekerHDWallet] SUI - Returning cached address:', suiAddress)
        return suiAddress
      }

      // Request SUI public key using BIP32 URI format
      const result = await this.messageHandler.getPublicKey(derivationPath)
      if (!result.publicKey) {
        throw new Error('Failed to get SUI public key from Seed Vault')
      }

      // Cache the base58-encoded public key
      this.suiPubkeyCache.set(cacheKey, result.publicKey)

      // Convert base58 public key to Ed25519PublicKey and derive SUI address
      const publicKey = new SolanaPublicKey(result.publicKey)
      const pubkeyBytes = Buffer.from(publicKey.toBytes())
      const suiPublicKey = new Ed25519PublicKey(pubkeyBytes)
      const suiAddress = suiPublicKey.toSuiAddress()
      console.log('[SeekerHDWallet] SUI address retrieved:', suiAddress)
      return suiAddress
    } catch (error) {
      console.error('Error getting SUI address from Seed Vault:', error)
      return null
    }
  }

  async suiSignTx(msg: SuiSignTx): Promise<SuiSignedTx | null> {
    alert('[SUI] ===== suiSignTx CALLED =====')
    console.log('[SUI] ===== suiSignTx CALLED =====')
    try {
      // Following native wallet pattern: hash intent message with BLAKE2b-256 before signing
      // Native: packages/hdwallet-native/src/crypto/isolation/adapters/sui.ts:59-77
      const blake2b = await createBLAKE2b(256)
      blake2b.init()
      blake2b.update(msg.intentMessageBytes)
      const messageHash = blake2b.digest('binary')

      const messageHashBase64 = Buffer.from(messageHash).toString('base64')

      const derivationPath = 'bip32:/' + addressNListToBIP32(msg.addressNList)
      alert(`[SUI] Using raw input path: ${derivationPath} (${msg.addressNList.length} levels), hash: ${messageHashBase64.substring(0, 20)}...`)
      const signResult = await this.messageHandler.signMessage(messageHashBase64, derivationPath)
      alert(`[SUI] ✓ Signature received from vault, length: ${signResult.signature?.length || 0}`)

      if (!signResult.signature) {
        alert('[SUI] ✗ No signature returned from vault!')
        throw new Error('Failed to sign SUI transaction')
      }

      const signatureBytes = Buffer.from(signResult.signature, 'base64')
      alert(`[SUI] Signature bytes length: ${signatureBytes.length} (expected 64)`)

      // Ed25519 signatures MUST be exactly 64 bytes
      if (signatureBytes.length !== 64) {
        throw new Error(`Invalid signature length for SUI: got ${signatureBytes.length} bytes, expected 64`)
      }

      const signature = signatureBytes.toString('hex')
      alert(`[SUI] Signature hex length: ${signature.length} (expected 128)`)

      const cacheKey = `${SeekerHDWallet.CACHE_VERSION}:${derivationPath}`
      const cachedPubkey = this.suiPubkeyCache.get(cacheKey) || this.pubkey
      const publicKey = new SolanaPublicKey(cachedPubkey)
      const pubkeyBytes = publicKey.toBytes()
      alert(`[SUI] Public key bytes length: ${pubkeyBytes.length} (expected 32)`)

      // Ed25519 public keys MUST be exactly 32 bytes
      if (pubkeyBytes.length !== 32) {
        throw new Error(`Invalid public key length for SUI: got ${pubkeyBytes.length} bytes, expected 32`)
      }

      const pubkeyHex = Buffer.from(pubkeyBytes).toString('hex')
      alert(`[SUI] Public key hex length: ${pubkeyHex.length} (expected 64)`)

      const result = {
        signature,
        publicKey: pubkeyHex,
      }

      alert(`[SUI] ✓ VALID - Returning sig=${signature.substring(0, 20)}... (${signature.length} chars), pubkey=${pubkeyHex.substring(0, 20)}... (${pubkeyHex.length} chars)`)
      console.log('[SUI] Final return:', JSON.stringify({ ...result, signature: result.signature.substring(0, 40) + '...', publicKey: result.publicKey.substring(0, 40) + '...' }))

      return result
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : ''
      alert(`[SUI] ✗ ERROR: ${errMsg}\n\nStack: ${stack?.substring(0, 300)}`)
      console.error('[SUI] ERROR:', error)
      throw error
    }
  }

  // TON Protocol support
  tonGetAccountPaths(msg: TonGetAccountPaths): TonAccountPath[] {
    // Solana Mobile Seed Vault requires 4-level paths for all chains: m/44'/607'/<account>'/0'
    // This matches Solana (m/44'/501'/<account>'/0'), NEAR (m/44'/397'/<account>'/0'), and SUI patterns
    const slip44 = 607 // TON
    return [
      {
        addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0x80000000 + 0],
      },
    ]
  }

  tonNextAccountPath(_msg: TonAccountPath): TonAccountPath | undefined {
    // Only support account #0, same as NEAR/SUI until multi-chain derivation is verified
    return undefined
  }

  async tonGetAddress(msg: TonGetAddress): Promise<string | null> {
    try {
      // Use raw input path directly (same pattern as NEAR which works)
      const derivationPath = 'bip32:/' + addressNListToBIP32(msg.addressNList)
      alert(`[TON] tonGetAddress using raw input path: ${derivationPath} (${msg.addressNList.length} levels)`)
      const cacheKey = `${SeekerHDWallet.CACHE_VERSION}:${derivationPath}`
      console.log('[SeekerHDWallet] TON - Requested derivation path:', derivationPath)
      console.log('[SeekerHDWallet] TON - Cache key:', cacheKey)
      console.log('[SeekerHDWallet] TON - Cache contents:', Array.from(this.tonPubkeyCache.entries()))

      // Check cache first
      const cachedPubkey = this.tonPubkeyCache.get(cacheKey)
      if (cachedPubkey) {
        console.log('[SeekerHDWallet] TON - Using cached public key:', cachedPubkey)
        const publicKey = new SolanaPublicKey(cachedPubkey)
        const pubkeyBytes = Buffer.from(publicKey.toBytes())
        const hexPubKey = pubkeyBytes.toString('hex')
        console.log('[SeekerHDWallet] TON - Public key hex:', hexPubKey)

        // Ed25519 public keys must be exactly 32 bytes
        if (pubkeyBytes.length !== 32) {
          throw new Error(`Bad public key size for TON: expected 32 bytes, got ${pubkeyBytes.length} bytes`)
        }

        // Derive TON wallet address from public key
        // TON uses WalletV4 contract by default with wallet_id 0x29a9a317 for mainnet
        const wallet = WalletContractV4.create({ workchain: 0, publicKey: pubkeyBytes })
        // Use non-bounceable format (UQ prefix) as the default for display
        const tonAddress = wallet.address.toString({ bounceable: false })
        console.log('[SeekerHDWallet] TON - Returning cached address:', tonAddress)
        return tonAddress
      }

      // Request TON public key using BIP32 URI format
      const result = await this.messageHandler.getPublicKey(derivationPath)
      if (!result.publicKey) {
        throw new Error('Failed to get TON public key from Seed Vault')
      }

      // Cache the base58-encoded public key
      this.tonPubkeyCache.set(cacheKey, result.publicKey)

      // Convert base58 public key to bytes and derive TON wallet address
      const publicKey = new SolanaPublicKey(result.publicKey)
      const pubkeyBytes = Buffer.from(publicKey.toBytes())

      // Ed25519 public keys must be exactly 32 bytes
      if (pubkeyBytes.length !== 32) {
        throw new Error(`Bad public key size for TON: expected 32 bytes, got ${pubkeyBytes.length} bytes`)
      }

      // Derive TON wallet address from public key
      // TON uses WalletV4 contract by default with wallet_id 0x29a9a317 for mainnet
      const wallet = WalletContractV4.create({ workchain: 0, publicKey: pubkeyBytes })
      // Use non-bounceable format (UQ prefix) as the default for display
      const tonAddress = wallet.address.toString({ bounceable: false })
      console.log('[SeekerHDWallet] TON address retrieved:', tonAddress)
      return tonAddress
    } catch (error) {
      console.error('Error getting TON address from Seed Vault:', error)
      return null
    }
  }

  async tonSignTx(msg: TonSignTx): Promise<TonSignedTx | null> {
    alert('[TON] ===== tonSignTx CALLED =====')
    console.log('[TON] ===== tonSignTx CALLED =====', { hasRawMessages: !!msg.rawMessages, hasMessage: !!msg.message })
    try {
      const derivationPath = 'bip32:/' + addressNListToBIP32(msg.addressNList)
      alert(`[TON] tonSignTx using raw input path: ${derivationPath} (${msg.addressNList.length} levels)`)

      const cacheKey = `${SeekerHDWallet.CACHE_VERSION}:${derivationPath}`
      let pubkeyBase58 = this.tonPubkeyCache.get(cacheKey)
      if (!pubkeyBase58) {
        const pubResult = await this.messageHandler.getPublicKey(derivationPath)
        if (!pubResult.publicKey) throw new Error('Failed to get TON public key from Seed Vault')
        pubkeyBase58 = pubResult.publicKey
        this.tonPubkeyCache.set(cacheKey, pubkeyBase58)
      }
      const pubkeyBytes = Buffer.from(new SolanaPublicKey(pubkeyBase58).toBytes())

      // Ed25519 public keys must be exactly 32 bytes
      if (pubkeyBytes.length !== 32) {
        throw new Error(`Bad public key size for TON signing: expected 32 bytes, got ${pubkeyBytes.length} bytes`)
      }

      const seedVaultSigner = async (message: Cell): Promise<Buffer> => {
        const hash = message.hash()
        const hashBase64 = hash.toString('base64')

        alert(`[TON] Signer called - hash: ${hashBase64.substring(0, 20)}..., path: ${derivationPath}`)
        const result = await this.messageHandler.signMessage(hashBase64, derivationPath)
        alert(`[TON] ✓ Vault returned signature, length: ${result.signature?.length || 0}`)

        if (!result.signature) {
          alert('[TON] ✗ No signature returned from vault!')
          throw new Error('Failed to sign TON transaction via Seed Vault - no signature returned')
        }

        const signatureBuffer = Buffer.from(result.signature, 'base64')
        alert(`[TON] Signature buffer length: ${signatureBuffer.length} bytes (expected 64)`)

        // Ed25519 signatures must be exactly 64 bytes
        if (signatureBuffer.length !== 64) {
          alert(`[TON] ✗ Bad signature size: ${signatureBuffer.length} bytes!`)
          throw new Error(`Bad signature size for TON signing: expected 64 bytes, got ${signatureBuffer.length} bytes`)
        }

        alert('[TON] ✓ Signature size valid (64 bytes)')

        // === DIAGNOSTIC: Verify ed25519 signature matches pubkey + hash ===
        const isValidSig = nacl.sign.detached.verify(
          new Uint8Array(hash),          // the 32-byte cell hash we asked Vault to sign
          new Uint8Array(signatureBuffer), // the 64-byte signature from Vault
          new Uint8Array(pubkeyBytes),     // the 32-byte pubkey from Vault at same derivation path
        )
        alert(`[TON] DIAGNOSTIC: ed25519 verify(hash, sig, pubkey) = ${isValidSig}`)
        console.log('[TON] DIAGNOSTIC ed25519 verify:', {
          isValid: isValidSig,
          hashHex: hash.toString('hex').substring(0, 40) + '...',
          sigHex: signatureBuffer.toString('hex').substring(0, 40) + '...',
          pubkeyHex: pubkeyBytes.toString('hex'),
          derivationPath,
        })
        if (!isValidSig) {
          alert('[TON] ✗ SIGNATURE INVALID! The Seed Vault signature does NOT verify against the pubkey+hash. This means either:\n1) Vault signed different data (double-hashing?)\n2) Vault used a different key than the pubkey we got\n3) Base64 encoding/decoding corrupted the data')
        }
        // === END DIAGNOSTIC ===

        return signatureBuffer
      }

      const wallet = WalletContractV4.create({ workchain: 0, publicKey: pubkeyBytes })
      const walletAddress = wallet.address.toString({ bounceable: true })
      const walletAddressNonBounce = wallet.address.toString({ bounceable: false })
      const pubkeyHex = pubkeyBytes.toString('hex')
      const inputPathStr = addressNListToBIP32(msg.addressNList)
      alert(`[TON] DIAGNOSTIC PATH:\n  Input addressNList: ${inputPathStr} (${msg.addressNList.length} levels)\n  Seeker remapped to: ${derivationPath}\n  Wallet (bounceable): ${walletAddress}\n  Wallet (non-bounce): ${walletAddressNonBounce}\n  Pubkey: ${pubkeyHex}`)
      console.log('[TON] DIAGNOSTIC wallet info:', {
        inputPath: inputPathStr,
        inputPathLevels: msg.addressNList.length,
        seekerPath: derivationPath,
        walletAddressBounceable: walletAddress,
        walletAddressNonBounceable: walletAddressNonBounce,
        publicKeyHex: pubkeyHex,
      })

      if (msg.rawMessages && msg.rawMessages.length > 0) {
        const seqno = msg.seqno ?? 0
        const expireAt = msg.expireAt ?? Math.floor(Date.now() / 1000) + 300
        const currentTime = Math.floor(Date.now() / 1000)

        alert(`[TON] TX params - seqno: ${seqno}, expireAt: ${expireAt}, currentTime: ${currentTime}, ttl: ${expireAt - currentTime}s, msgs: ${msg.rawMessages.length}`)
        console.log('[TON] Transaction parameters:', { seqno, expireAt, currentTime, timeToLive: expireAt - currentTime, messageCount: msg.rawMessages.length })

        const internalMessages = msg.rawMessages.map((rawMsg, idx) => {
          alert(`[TON] rawMsg[${idx}]: to=${rawMsg.targetAddress.substring(0, 10)}..., amount=${rawMsg.sendAmount}, hasPayload=${!!(rawMsg.payload && rawMsg.payload.length > 0)}, hasStateInit=${!!(rawMsg.stateInit && rawMsg.stateInit.length > 0)}`)
          console.log(`[TON] Processing rawMessage ${idx}:`, {
            to: rawMsg.targetAddress,
            amount: rawMsg.sendAmount,
            payloadLength: rawMsg.payload?.length || 0,
            stateInitLength: rawMsg.stateInit?.length || 0
          })
          const destination = Address.parse(rawMsg.targetAddress)
          const value = BigInt(rawMsg.sendAmount)

          let body: Cell
          if (rawMsg.payload && rawMsg.payload.length > 0) {
            const payloadBuffer = Buffer.from(rawMsg.payload, 'hex')
            body = Cell.fromBoc(payloadBuffer)[0]
          } else {
            body = beginCell().endCell()
          }

          let init: { code: Cell; data: Cell } | undefined
          if (rawMsg.stateInit && rawMsg.stateInit.length > 0) {
            const stateInitBuffer = Buffer.from(rawMsg.stateInit, 'hex')
            const stateInitCell = Cell.fromBoc(stateInitBuffer)[0]
            const stateInitSlice = stateInitCell.beginParse()
            const hasCode = stateInitSlice.loadBit()
            const hasData = stateInitSlice.loadBit()
            if (hasCode && hasData) {
              init = {
                code: stateInitSlice.loadRef(),
                data: stateInitSlice.loadRef(),
              }
            }
          }

          return internal({
            to: destination,
            value,
            bounce: true,
            body,
            init,
          })
        })

        type CreateTransferSignable = (args: {
          seqno: number
          signer: (message: Cell) => Promise<Buffer>
          messages: typeof internalMessages
          sendMode: number
          timeout: number
        }) => Promise<Cell>

        const createTransfer = wallet.createTransfer.bind(wallet) as unknown as CreateTransferSignable

        alert(`[TON] rawMessages path - about to call createTransfer with seqno: ${seqno}, messages: ${internalMessages.length}`)
        let transfer
        try {
          transfer = await createTransfer({
            seqno,
            signer: seedVaultSigner,
            messages: internalMessages,
            sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
            timeout: expireAt,
          })
          alert('[TON] ✓ createTransfer completed successfully (rawMessages path)')
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error)
          const stack = error instanceof Error ? error.stack : ''
          alert(`[TON] ✗ createTransfer FAILED (rawMessages path): ${errMsg}\n\nStack: ${stack?.substring(0, 200)}`)
          console.error('[TON] createTransfer FAILED (rawMessages path):', error)
          throw error
        }

        const externalMessage = beginCell()
          .store(
            storeMessage({
              info: {
                type: 'external-in',
                dest: wallet.address,
                importFee: BigInt(0),
              },
              init: seqno === 0 ? wallet.init : null,
              body: transfer,
            })
          )
          .endCell()

        const bocBase64 = externalMessage.toBoc().toString('base64')

        if (!bocBase64 || bocBase64.length === 0) {
          throw new Error('[TON] Generated BOC is empty!')
        }

        try {
          const bocBytes = Buffer.from(bocBase64, 'base64')
          const roundTrip = Cell.fromBoc(bocBytes)[0]
          const transferBody = roundTrip.refs.length > 0 ? roundTrip.refs[0] : null
          const transferHash = transferBody ? transferBody.hash().toString('hex').substring(0, 40) : 'NO_BODY'
          alert(`[TON] DIAGNOSTIC BOC (rawMessages):\n  BOC size: ${bocBytes.length} bytes\n  Round-trip parse: OK\n  Transfer body hash: ${transferHash}...\n  seqno: ${seqno}, init included: ${seqno === 0}`)
          console.log('[TON] DIAGNOSTIC BOC:', {
            bocBytesLength: bocBytes.length,
            base64Length: bocBase64.length,
            roundTripOk: true,
            transferBodyHash: transferHash,
            seqno,
            initIncluded: seqno === 0,
          })
        } catch (e) {
          alert(`[TON] ✗ BOC verification FAILED: ${e}`)
          throw new Error(`[TON] Generated BOC is invalid: ${e}`)
        }

        const result = {
          signature: '',
          serialized: bocBase64,
        }

        alert(`[TON] ✓ VALID - Returning BOC: ${bocBase64.substring(0, 40)}... (total length: ${bocBase64.length})`)
        console.log('[TON] Final return (rawMessages):', JSON.stringify({ ...result, serialized: result.serialized.substring(0, 100) + `... (${result.serialized.length} total chars)` }))

        return result
      }

      if (!msg.message) {
        throw new Error('Either message or rawMessages must be provided')
      }

      const messageJson = new TextDecoder().decode(msg.message)
      let txParams: { from: string; to: string; value: string; seqno: number; expireAt: number; memo?: string; contractAddress?: string; type?: string }
      try {
        txParams = JSON.parse(messageJson)
      } catch (error) {
        throw new Error(`Failed to parse TON transaction message: ${error instanceof Error ? error.message : String(error)}`)
      }

      const seqno = txParams.seqno ?? msg.seqno ?? 0
      const expireAt = txParams.expireAt ?? msg.expireAt ?? Math.floor(Date.now() / 1000) + 300
      const currentTime = Math.floor(Date.now() / 1000)
      const destination = Address.parse(txParams.to)

      alert(`[TON] Simple path - seqno: ${seqno}, expireAt: ${expireAt}, currentTime: ${currentTime}, ttl: ${expireAt - currentTime}s, type: ${txParams.type || 'transfer'}`)
      alert(`[TON] Simple path - from: ${txParams.from.substring(0, 10)}..., to: ${txParams.to.substring(0, 10)}..., value: ${txParams.value}`)
      console.log('[TON] Simple transaction parameters:', {
        seqno,
        expireAt,
        currentTime,
        timeToLive: expireAt - currentTime,
        type: txParams.type || 'transfer',
        from: txParams.from,
        to: txParams.to,
        value: txParams.value,
        memo: txParams.memo,
        contractAddress: txParams.contractAddress
      })

      // Verify wallet address matches the sender address
      const fromAddressNormalized = Address.parse(txParams.from).toString({ bounceable: true })
      if (walletAddress !== fromAddressNormalized) {
        alert(`[TON] ⚠️ ADDRESS MISMATCH!\nWallet: ${walletAddress}\nFrom: ${fromAddressNormalized}`)
        console.warn('[TON] Address mismatch detected:', { walletAddress, fromAddress: fromAddressNormalized })
      } else {
        alert('[TON] ✓ Wallet address matches sender address')
      }

      let internalMessage: MessageRelaxed
      if (txParams.type === 'jetton_transfer' && txParams.contractAddress) {
        alert(`[TON] Building JETTON transfer to contract: ${txParams.contractAddress.substring(0, 10)}...`)
        console.log('[TON] Building jetton transfer:', { jettonWalletAddress: txParams.contractAddress })
        const jettonWalletAddress = Address.parse(txParams.contractAddress)
        const forwardPayload = txParams.memo
          ? beginCell().storeUint(0, 32).storeStringTail(txParams.memo).endCell()
          : beginCell().endCell()

        const jettonTransferBody = beginCell()
          .storeUint(0x0f8a7ea5, 32)
          .storeUint(0, 64)
          .storeCoins(BigInt(txParams.value))
          .storeAddress(destination)
          .storeAddress(Address.parse(txParams.from))
          .storeBit(false)
          .storeCoins(BigInt(1))
          .storeBit(true)
          .storeRef(forwardPayload)
          .endCell()

        internalMessage = internal({
          to: jettonWalletAddress,
          value: BigInt(100000000),
          bounce: true,
          body: jettonTransferBody,
        })
      } else {
        internalMessage = internal({
          to: destination,
          value: BigInt(txParams.value),
          bounce: false,
          body: txParams.memo
            ? beginCell().storeUint(0, 32).storeStringTail(txParams.memo).endCell()
            : beginCell().endCell(),
        })
      }

      type CreateTransferSignable = (args: {
        seqno: number
        signer: (message: Cell) => Promise<Buffer>
        messages: MessageRelaxed[]
        sendMode: number
        timeout: number
      }) => Promise<Cell>

      const createTransferSimple = wallet.createTransfer.bind(wallet) as unknown as CreateTransferSignable

      alert(`[TON] simple path - about to call createTransfer with seqno: ${seqno}, type: ${txParams.type || 'transfer'}`)
      let transfer
      try {
        transfer = await createTransferSimple({
          seqno,
          signer: seedVaultSigner,
          messages: [internalMessage],
          sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
          timeout: expireAt,
        })
        alert('[TON] ✓ createTransfer completed successfully (simple path)')
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error)
        const stack = error instanceof Error ? error.stack : ''
        alert(`[TON] ✗ createTransfer FAILED (simple path): ${errMsg}\n\nStack: ${stack?.substring(0, 200)}`)
        console.error('[TON] createTransfer FAILED (simple path):', error)
        throw error
      }

      const externalMessage = beginCell()
        .store(
          storeMessage({
            info: {
              type: 'external-in',
              dest: wallet.address,
              importFee: BigInt(0),
            },
            init: seqno === 0 ? wallet.init : null,
            body: transfer,
          })
        )
        .endCell()

      const bocBase64 = externalMessage.toBoc().toString('base64')

      if (!bocBase64 || bocBase64.length === 0) {
        throw new Error('[TON] Generated BOC is empty!')
      }

      alert(`[TON] Generated BOC length: ${bocBase64.length} chars`)

      // Verify BOC is valid base64
      try {
        Buffer.from(bocBase64, 'base64')
        alert('[TON] ✓ BOC is valid base64')
      } catch (e) {
        throw new Error(`[TON] Generated BOC is not valid base64: ${e}`)
      }

      const result = {
        signature: '',
        serialized: bocBase64,
      }

      alert(`[TON] ✓ VALID - Returning BOC: ${bocBase64.substring(0, 40)}... (total length: ${bocBase64.length})`)
      console.log('[TON] Final return (simple):', JSON.stringify({ ...result, serialized: result.serialized.substring(0, 100) + `... (${result.serialized.length} total chars)` }))

      return result
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : ''
      alert(`[TON] ✗ TOP-LEVEL ERROR: ${errMsg}\n\nStack: ${stack?.substring(0, 300)}`)
      console.error('[TON] TOP-LEVEL ERROR:', error)
      throw error
    }
  }
}
