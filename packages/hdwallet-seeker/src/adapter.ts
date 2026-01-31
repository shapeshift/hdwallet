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
} from '@shapeshiftoss/hdwallet-core'
import {
  nearGetAccountPaths,
  nearAddressNListToBIP32,
  solanaBuildTransaction,
} from '@shapeshiftoss/hdwallet-core'
import { PublicKey as SolanaPublicKey } from '@solana/web3.js'

import type { SeekerMessageHandler } from './types'

export class SeekerHDWallet implements HDWallet {
  private deviceId: string
  private pubkey: string
  private messageHandler: SeekerMessageHandler
  private nearPubkeyCache: Map<string, string> = new Map()

  readonly _supportsSolana = true
  readonly _supportsSolanaInfo = true
  // NEAR support: Experimental - requestPublicKey may not be fully supported by all MWA implementations
  // See SeekerWalletManager.getPublicKey() for implementation details
  readonly _supportsNear = true
  readonly _supportsNearInfo = true

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

  solanaGetAccountPaths(_msg: SolanaGetAccountPaths): SolanaAccountPath[] {
    const SOLANA_BIP44_PATH: BIP32Path = [0x80000000 + 44, 0x80000000 + 501, 0x80000000 + 0]
    return [{ addressNList: SOLANA_BIP44_PATH }]
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
      console.log('[SeekerHDWallet] Getting NEAR address for path:', derivationPath, 'raw addressNList:', msg.addressNList)

      // Check cache first
      const cachedPubkey = this.nearPubkeyCache.get(derivationPath)
      if (cachedPubkey) {
        console.log('[SeekerHDWallet] Using cached NEAR public key')
        const publicKey = new SolanaPublicKey(cachedPubkey)
        const hexPublicKey = Buffer.from(publicKey.toBytes()).toString('hex')
        return hexPublicKey
      }

      // Request NEAR public key using BIP32 URI format
      const result = await this.messageHandler.getPublicKey(derivationPath)
      if (!result.publicKey) {
        throw new Error('Failed to get NEAR public key from Seed Vault')
      }

      // Cache the base58-encoded public key for this derivation path
      this.nearPubkeyCache.set(derivationPath, result.publicKey)

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
    return nearGetAccountPaths(msg)
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
}
