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
    try {
      const intentMessageBase64 = Buffer.from(msg.intentMessageBytes).toString('base64')

      // Remap to Seeker's 4-level path — Seed Vault only signs with the path used to derive the key
      const accountIdx = (msg.addressNList[2] ?? 0) & 0x7fffffff
      const seekerPath = this.suiGetAccountPaths({ accountIdx })[0]
      const derivationPath = 'bip32:/' + addressNListToBIP32(seekerPath.addressNList)

      alert(`[SUI] path: ${derivationPath}, intentMsg len: ${intentMessageBase64.length}, addressNList: ${JSON.stringify(msg.addressNList)}`)

      const result = await this.messageHandler.signMessage(intentMessageBase64, derivationPath)
      if (!result.signature) {
        throw new Error('Failed to sign SUI transaction')
      }

      const signatureBytes = Buffer.from(result.signature, 'base64')
      const signature = signatureBytes.toString('hex')

      const cacheKey = `${SeekerHDWallet.CACHE_VERSION}:${derivationPath}`
      const cachedPubkey = this.suiPubkeyCache.get(cacheKey) || this.pubkey
      const publicKey = new SolanaPublicKey(cachedPubkey)
      const pubkeyHex = Buffer.from(publicKey.toBytes()).toString('hex')

      alert(`[SUI] signed OK, sig len: ${signatureBytes.length}`)
      return {
        signature,
        publicKey: pubkeyHex,
      }
    } catch (error) {
      const msg2 = error instanceof Error ? error.message : String(error)
      alert(`[SUI signTx ERROR] ${msg2}`)
      throw error
    }
  }

  // TON Protocol support
  tonGetAccountPaths(msg: TonGetAccountPaths): TonAccountPath[] {
    // Solana Mobile Seed Vault uses 4-level paths for all chains (matching Solana structure)
    // m/44'/607'/<account>'/0' instead of standard 3-level m/44'/607'/<account>'
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
    // TON uses derivation path m/44'/607'/x' (3 levels, all hardened)
    try {
      const derivationPath = 'bip32:/' + addressNListToBIP32(msg.addressNList)
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
    try {
      // Remap to Seeker's 4-level path — Seed Vault only signs with the path used to derive the key
      const accountIdx = (msg.addressNList[2] ?? 0) & 0x7fffffff
      const seekerPath = this.tonGetAccountPaths({ accountIdx })[0]
      const derivationPath = 'bip32:/' + addressNListToBIP32(seekerPath.addressNList)

      const hasRaw = msg.rawMessages && msg.rawMessages.length > 0
      alert(`[TON] path: ${derivationPath}, rawMessages: ${hasRaw ? msg.rawMessages!.length : 'none'}, addressNList: ${JSON.stringify(msg.addressNList)}`)

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
        alert(`[TON signer] signing hash len: ${hash.length}, path: ${derivationPath}`)
        const result = await this.messageHandler.signMessage(hashBase64, derivationPath)
        if (!result.signature) throw new Error('Failed to sign TON transaction via Seed Vault')

        const signatureBuffer = Buffer.from(result.signature, 'base64')
        alert(`[TON signer] signature received, len: ${signatureBuffer.length}`)

        // Ed25519 signatures must be exactly 64 bytes
        if (signatureBuffer.length !== 64) {
          throw new Error(`Bad signature size for TON signing: expected 64 bytes, got ${signatureBuffer.length} bytes`)
        }

        return signatureBuffer
      }

      const wallet = WalletContractV4.create({ workchain: 0, publicKey: pubkeyBytes })

      if (msg.rawMessages && msg.rawMessages.length > 0) {
        const seqno = msg.seqno ?? 0
        const expireAt = msg.expireAt ?? Math.floor(Date.now() / 1000) + 300

        const internalMessages = msg.rawMessages.map((rawMsg) => {
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

        alert(`[TON] rawMessages built: ${internalMessages.length}, seqno: ${seqno}, calling createTransfer...`)

        type CreateTransferSignable = (args: {
          seqno: number
          signer: (message: Cell) => Promise<Buffer>
          messages: typeof internalMessages
          sendMode: number
          timeout: number
        }) => Promise<Cell>

        const createTransfer = wallet.createTransfer.bind(wallet) as unknown as CreateTransferSignable

        const transfer = await createTransfer({
          seqno,
          signer: seedVaultSigner,
          messages: internalMessages,
          sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
          timeout: expireAt,
        })

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
        alert(`[TON] rawMessages tx signed OK, BOC len: ${bocBase64.length}`)

        return {
          signature: '',
          serialized: bocBase64,
        }
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
      const destination = Address.parse(txParams.to)

      let internalMessage: MessageRelaxed
      if (txParams.type === 'jetton_transfer' && txParams.contractAddress) {
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

      alert(`[TON] simple tx built, type: ${txParams.type ?? 'transfer'}, seqno: ${seqno}, calling createTransfer...`)

      type CreateTransferSignable = (args: {
        seqno: number
        signer: (message: Cell) => Promise<Buffer>
        messages: MessageRelaxed[]
        sendMode: number
        timeout: number
      }) => Promise<Cell>

      const createTransferSimple = wallet.createTransfer.bind(wallet) as unknown as CreateTransferSignable

      const transfer = await createTransferSimple({
        seqno,
        signer: seedVaultSigner,
        messages: [internalMessage],
        sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
        timeout: expireAt,
      })

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
      alert(`[TON] simple tx signed OK, BOC len: ${bocBase64.length}`)

      return {
        signature: '',
        serialized: bocBase64,
      }
    } catch (error) {
      const msg2 = error instanceof Error ? error.message : String(error)
      alert(`[TON signTx ERROR] ${msg2}`)
      throw error
    }
  }
}
