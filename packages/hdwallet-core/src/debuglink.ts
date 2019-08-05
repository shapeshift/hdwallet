
export abstract class DebugLinkWallet {
  _supportsDebugLink: boolean = true

  public abstract async pressYes (): Promise<void>
  public abstract async pressNo (): Promise<void>
  public abstract async press (isYes: boolean): Promise<void>
}
