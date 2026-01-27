/**
 * Result types for Seeker wallet operations
 */

export type SeekerAvailabilityResult = {
  available: boolean
}

export type SeekerAuthResult = {
  success: boolean
  address?: string
  label?: string
  error?: string
}

export type SeekerAddressResult = {
  address: string | null
}

export type SeekerStatusResult = {
  available: boolean
  isAuthorized: boolean
  address: string | null
}

export type SeekerSignResult = {
  success: boolean
  signedTransaction?: string
  error?: string
}

export type SeekerSendResult = {
  success: boolean
  signature?: string
  error?: string
}

/**
 * Message handler interface that must be implemented by the host application
 * to communicate with the Seeker wallet (e.g., via React Native WebView postMessage)
 */
export interface SeekerMessageHandler {
  /**
   * Check if Seeker wallet is available
   */
  checkAvailability(): Promise<SeekerAvailabilityResult>

  /**
   * Request authorization from Seeker wallet
   * @param cluster - Solana cluster to connect to
   */
  authorize(cluster?: 'mainnet-beta' | 'devnet' | 'testnet'): Promise<SeekerAuthResult>

  /**
   * Deauthorize from Seeker wallet
   */
  deauthorize(): Promise<{ success: boolean; error?: string }>

  /**
   * Get the authorized Solana address
   */
  getAddress(): Promise<SeekerAddressResult>

  /**
   * Get the current Seeker wallet status
   */
  getStatus(): Promise<SeekerStatusResult>

  /**
   * Sign a transaction
   * @param transaction - Base64 encoded serialized transaction
   */
  signTransaction(transaction: string): Promise<SeekerSignResult>

  /**
   * Sign and send a transaction
   * @param transaction - Base64 encoded serialized transaction
   */
  signAndSendTransaction(transaction: string): Promise<SeekerSendResult>
}

/**
 * App identity configuration for Mobile Wallet Adapter
 */
export interface SeekerAppIdentity {
  name: string
  uri: string
  icon: string
}

/**
 * Seeker wallet configuration
 */
export interface SeekerConfig {
  appIdentity: SeekerAppIdentity
  cluster?: 'mainnet-beta' | 'devnet' | 'testnet'
}
