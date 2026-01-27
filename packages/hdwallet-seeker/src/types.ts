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

export interface SeekerMessageHandler {
  checkAvailability(): Promise<SeekerAvailabilityResult>
  authorize(cluster?: 'mainnet-beta' | 'devnet' | 'testnet'): Promise<SeekerAuthResult>
  deauthorize(): Promise<{ success: boolean; error?: string }>
  getAddress(): Promise<SeekerAddressResult>
  getStatus(): Promise<SeekerStatusResult>
  signTransaction(transaction: string): Promise<SeekerSignResult>
  signAndSendTransaction(transaction: string): Promise<SeekerSendResult>
}

export interface SeekerAppIdentity {
  name: string
  uri: string
  icon: string
}

export interface SeekerConfig {
  appIdentity: SeekerAppIdentity
  cluster?: 'mainnet-beta' | 'devnet' | 'testnet'
}
