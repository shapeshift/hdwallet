import { BitBox02API, getDevicePath } from "bitbox02-api";
import {
  Keyring,
  HDWallet,
  BTCWallet,
  ETHWallet,
  Events,
  ActionCancelled,
  Transport,
  Coin,
  DescribePath,
  PathDescription,
  GetPublicKey,
  PublicKey,
  Ping,
  Pong,
  ResetDevice,
  RecoverDevice,
  LoadDevice,
  HDWalletInfo,
  BTCWalletInfo,
  ETHWalletInfo,
  CosmosWalletInfo,
  BinanceWalletInfo,
} from "@shapeshiftoss/hdwallet-core";

export class BitBox02HDWallet
  implements
    HDWalletInfo,
    BTCWalletInfo,
    ETHWalletInfo,
    CosmosWalletInfo,
    BinanceWalletInfo {
  _supportsBTCInfo: boolean = true;
  _supportsETHInfo: boolean = true;
  _supportsCosmosInfo: boolean = true;
  _supportsBinanceInfo: boolean = true;

  transport: BitBox02Transport;

  constructor(transport: BitBox02Transport) {
    this.transport = transport;
  }

  /*
   * HDWalletInfo methods:
   */

  public getVendor(): string {
    return "Shift Cryptosecurity";
  }

  public hasOnDevicePinEntry(): boolean {
    return true;
  }

  public hasOnDevicePassphrase(): boolean {
    return true;
  }

  public hasOnDeviceDisplay(): boolean {
    return true;
  }

  public hasOnDeviceRecovery(): boolean {
    return true;
  }

  public hasNativeShapeShift(srcCoin: Coin, dstCoin: Coin): boolean {
    return false;
  }

  // TODO: Implement the descriptions properly
  public describePath(msg: DescribePath): PathDescription {
    switch (msg.coin) {
      case "Ethereum":
        return {
          verbose: "Ethereum Account #",
          accountIdx: 0,
          wholeAccount: true,
          coin: msg.coin,
          isKnown: true,
        };
      case "Bitcoin":
        return {
          verbose: "Bitcoin Account",
          accountIdx: 0,
          wholeAccount: true,
          coin: msg.coin,
          isKnown: true,
        };
      default:
        throw new Error("Unsupported path");
    }
  }

  /*
   * HDWallet methods:
   */
  _supportsBTC: boolean = true;
  _supportsETH: boolean = true;
  _supportsCosmos: boolean = false;
  _supportsBinance: boolean = false;
  _supportsDebugLink: boolean = false;

  public async getDeviceID(): Promise<string> {
    return Promise.resolve(this.transport.path);
  }

  public async getFirmwareVersion(): Promise<string> {
    return Promise.resolve("0.0.0");
  }

  public async getModel(): Promise<string> {
    return Promise.resolve("BitBox02");
  }

  public async getLabel(): Promise<string> {
    return Promise.resolve("My BitBox");
  }

  public async getPublicKeys(
    msg: Array<GetPublicKey>
  ): Promise<Array<PublicKey | null>> {
    return Promise.resolve(Array(null));
  }

  public async isInitialized(): Promise<boolean> {
    // TODO: Implement
    return Promise.resolve(true);
  }

  public async isLocked(): Promise<boolean> {
    // TODO: Not sure if bb02 has this
    return Promise.resolve(true);
  }

  public async clearSession(): Promise<void> {
    // TODO: Not sure if bb02 has this
    return Promise.resolve();
  }

  public async initialize(): Promise<any> {
    // TODO: Implement
    return Promise.resolve();
  }

  public async ping(msg: Ping): Promise<Pong> {
    // No ping functionality
    return Promise.resolve({ msg: msg.msg });
  }
  public async sendPin(pin: string): Promise<void> {
    // No pin
    return Promise.resolve();
  }
  public async sendPassphrase(passphrase: string): Promise<void> {
    // No passphrase
    return Promise.resolve();
  }
  public async sendCharacter(charater: string): Promise<void> {
    // No sendCharacter
    return Promise.resolve();
  }
  public async sendWord(word: string): Promise<void> {
    // No sendWord
    return Promise.resolve();
  }
  public async cancel(): Promise<void> {
    // No cancel
    return Promise.resolve();
  }
  public async wipe(): Promise<void> {
    // TODO: implement wipe
    return Promise.resolve();
  }
  public async reset(msg: ResetDevice): Promise<void> {
    // TODO: implement reset
    return Promise.resolve();
  }
  public async recover(msg: RecoverDevice): Promise<void> {
    // TODO: implement recover
    return Promise.resolve();
  }
  public async loadDevice(msg: LoadDevice): Promise<void> {
    // no loadDevice (Cannot load seed phrase from host)
    return Promise.resolve();
  }
  public async disconnect(): Promise<void> {
    // TODO: implement disconnect
    return Promise.resolve();
  }

  /*
              Multi coin support
          */
  btcSupportsCoin(coin: string): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  btcSupportsScriptType(
    coin: string,
    scriptType: import("@shapeshiftoss/hdwallet-core").BTCInputScriptType
  ): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  btcSupportsSecureTransfer(): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  btcSupportsNativeShapeShift(): boolean {
    throw new Error("Method not implemented.");
  }
  btcGetAccountPaths(
    msg: import("@shapeshiftoss/hdwallet-core").BTCGetAccountPaths
  ): import("@shapeshiftoss/hdwallet-core").BTCAccountPath[] {
    throw new Error("Method not implemented.");
  }
  btcIsSameAccount(
    msg: import("@shapeshiftoss/hdwallet-core").BTCAccountPath[]
  ): boolean {
    throw new Error("Method not implemented.");
  }
  btcNextAccountPath(
    msg: import("@shapeshiftoss/hdwallet-core").BTCAccountPath
  ): import("@shapeshiftoss/hdwallet-core").BTCAccountPath {
    throw new Error("Method not implemented.");
  }
  ethSupportsNetwork(chain_id: number): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  ethSupportsSecureTransfer(): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  ethSupportsNativeShapeShift(): boolean {
    throw new Error("Method not implemented.");
  }
  ethGetAccountPaths(
    msg: import("@shapeshiftoss/hdwallet-core").ETHGetAccountPath
  ): import("@shapeshiftoss/hdwallet-core").ETHAccountPath[] {
    throw new Error("Method not implemented.");
  }
  ethNextAccountPath(
    msg: import("@shapeshiftoss/hdwallet-core").ETHAccountPath
  ): import("@shapeshiftoss/hdwallet-core").ETHAccountPath {
    throw new Error("Method not implemented.");
  }
  cosmosGetAccountPaths(
    msg: import("@shapeshiftoss/hdwallet-core").CosmosGetAccountPaths
  ): import("@shapeshiftoss/hdwallet-core").CosmosAccountPath[] {
    throw new Error("Method not implemented.");
  }
  cosmosNextAccountPath(
    msg: import("@shapeshiftoss/hdwallet-core").CosmosAccountPath
  ): import("@shapeshiftoss/hdwallet-core").CosmosAccountPath {
    throw new Error("Method not implemented.");
  }
  binanceGetAccountPaths(
    msg: import("@shapeshiftoss/hdwallet-core").BinanceGetAccountPaths
  ): import("@shapeshiftoss/hdwallet-core").BinanceAccountPath[] {
    throw new Error("Method not implemented.");
  }
  binanceNextAccountPath(
    msg: import("@shapeshiftoss/hdwallet-core").BinanceAccountPath
  ): import("@shapeshiftoss/hdwallet-core").BinanceAccountPath {
    throw new Error("Method not implemented.");
  }
}

export class BitBox02Adapter {
  keyring: Keyring;

  private constructor(keyring: Keyring) {
    this.keyring = keyring;
  }

  public static useKeyring(keyring: Keyring) {
    return new BitBox02Adapter(keyring);
  }

  // TODO: Support multuple devices
  public async initialize(
    path?: string,
    autoConnect: boolean = true
  ): Promise<number> {
    let pathToInit;
    try {
      // Right now the bitbox02 API will only return 1 device path
      pathToInit = path || (await getDevicePath());
    } catch (e) {
      console.error("no bitbox02");
      return Object.keys(this.keyring.wallets).length;
    }
    // skip if already initialized
    if (!(pathToInit in this.keyring.wallets)) {
      const transport = new BitBox02Transport(pathToInit, this.keyring);
      if (autoConnect === true) {
        await transport.connect();
      }
      const wallet = new BitBox02HDWallet(transport);
      this.keyring.add(wallet, pathToInit);
    }
    return Object.keys(this.keyring.wallets).length;
  }

  // TODO: Support multiple devices
  public async pairDevice(): Promise<HDWallet> {
    const path = await getDevicePath();
    await this.initialize(path);
    return this.keyring.get(path);
  }

  private async pairBitBox02Device(): Promise<HDWallet> {
    return Promise.resolve(undefined);
  }
}

// For now implement one transport, the one over the bridge
export class BitBox02Transport extends Transport {
  path: string;
  bitbox02_api: any;

  constructor(path: string, keyring: Keyring) {
    super(keyring);
    this.path = path;
    this.bitbox02_api = new BitBox02API(this.path);
  }

  public getDeviceID(): string {
    return this.path;
  }

  // TODO: Forward all calls to device
  public call(...args: any[]): Promise<any> {
    console.log(args);
    return Promise.resolve();
  }
  public async connect(): Promise<any> {
    try {
      await this.bitbox02_api.connect(
        /* showPairingCb= */ (pairingCode) => {
          alert(pairingCode);
        },
        /* userVerify= */ async () => {
          Promise.resolve();
        },
        /* handleAttestationCb= */ (attestationResult) => {},
        /* onCloseCb */ () => {},
        /* setStatusCb */ (status) => {}
      );
    } catch (e) {
      console.error(e);
    }
    return Promise.resolve();
  }
  //public listen(): Promise<any> {
  //}
  //public disconnect(): Promise<any> {
  //}
}
