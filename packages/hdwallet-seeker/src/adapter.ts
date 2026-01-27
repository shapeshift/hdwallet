import type {
  BIP32Path,
  DescribePath,
  GetPublicKey,
  HDWallet,
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
import { solanaBuildTransaction } from '@shapeshiftoss/hdwallet-core'

import type { SeekerMessageHandler } from './types'

export class SeekerHDWallet implements HDWallet {
  private deviceId: string
  private pubkey: string
  private messageHandler: SeekerMessageHandler

  readonly _supportsSolana = true
  readonly _supportsSolanaInfo = true

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
}
