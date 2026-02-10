import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import type {
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
} from "@shapeshiftoss/hdwallet-core";
import { addressNListToBIP32, nearAddressNListToBIP32, solanaBuildTransaction } from "@shapeshiftoss/hdwallet-core";
import { PublicKey as SolanaPublicKey } from "@solana/web3.js";
import type { MessageRelaxed } from "@ton/core";
import { Address, beginCell, Cell, internal, SendMode, storeMessage } from "@ton/core";
import { WalletContractV4 } from "@ton/ton";
import crypto from "crypto";
import { createBLAKE2b } from "hash-wasm";

import type { SeekerMessageHandler } from "./types";

export class SeekerHDWallet implements HDWallet {
  private deviceId: string;
  private pubkey: string;
  private messageHandler: SeekerMessageHandler;
  // Cache version to invalidate old entries when derivation paths change
  private static readonly CACHE_VERSION = "v2";
  private nearPubkeyCache: Map<string, string> = new Map();
  private suiPubkeyCache: Map<string, string> = new Map();
  private tonPubkeyCache: Map<string, string> = new Map();

  readonly _supportsSolana = true;
  readonly _supportsSolanaInfo = true;
  // NEAR support: Experimental - requestPublicKey may not be fully supported by all MWA implementations
  // See SeekerWalletManager.getPublicKey() for implementation details
  readonly _supportsNear = true;
  readonly _supportsNearInfo = true;
  readonly _supportsSui = true;
  readonly _supportsSuiInfo = true;
  readonly _supportsTon = true;
  readonly _supportsTonInfo = true;

  constructor(deviceId: string, pubkey: string, messageHandler: SeekerMessageHandler) {
    this.deviceId = deviceId;
    this.pubkey = pubkey;
    this.messageHandler = messageHandler;
  }

  getVendor(): string {
    return "Seeker";
  }

  hasOnDevicePinEntry(): boolean {
    return false;
  }

  hasOnDevicePassphrase(): boolean {
    return false;
  }

  hasOnDeviceDisplay(): boolean {
    return true;
  }

  hasOnDeviceRecovery(): boolean {
    return true;
  }

  hasNativeShapeShift(): boolean {
    return false;
  }

  supportsBip44Accounts(): boolean {
    return false;
  }

  supportsOfflineSigning(): boolean {
    return false;
  }

  supportsBroadcast(): boolean {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  describePath(_msg: DescribePath): PathDescription {
    return {
      isKnown: false,
      verbose: "Seeker Solana",
      coin: "Solana",
    };
  }

  getDeviceID(): Promise<string> {
    return Promise.resolve(this.deviceId);
  }

  getFeatures(): Promise<Record<string, unknown>> {
    return Promise.resolve({
      vendor: "Seeker",
      model: "Seeker",
      label: "Seeker Wallet",
    });
  }

  getFirmwareVersion(): Promise<string> {
    return Promise.resolve("1.0.0");
  }

  getModel(): Promise<string> {
    return Promise.resolve("Seeker");
  }

  getLabel(): Promise<string> {
    return Promise.resolve("Seeker Wallet");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getPublicKeys(_msg: GetPublicKey[]): Promise<(PublicKey | null)[] | null> {
    return Promise.resolve([{ xpub: this.pubkey }]);
  }

  isInitialized(): Promise<boolean> {
    return Promise.resolve(true);
  }

  isLocked(): Promise<boolean> {
    return Promise.resolve(false);
  }

  clearSession(): Promise<void> {
    return Promise.resolve();
  }

  initialize(): Promise<void> {
    return Promise.resolve();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ping(_msg: Ping): Promise<Pong> {
    return Promise.resolve({ msg: "pong" });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  sendPin(_pin: string): Promise<void> {
    return Promise.resolve();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  sendPassphrase(_passphrase: string): Promise<void> {
    return Promise.resolve();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  sendCharacter(_character: string): Promise<void> {
    return Promise.resolve();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  sendWord(_word: string): Promise<void> {
    return Promise.resolve();
  }

  cancel(): Promise<void> {
    return Promise.resolve();
  }

  wipe(): Promise<void> {
    return Promise.resolve();
  }

  reset(): Promise<void> {
    return Promise.resolve();
  }

  recover(): Promise<void> {
    return Promise.resolve();
  }

  loadDevice(): Promise<void> {
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    return Promise.resolve();
  }

  getAddress(): string {
    return this.pubkey;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  solanaGetAddress(_msg: SolanaGetAddress): Promise<string | null> {
    return Promise.resolve(this.pubkey);
  }

  solanaGetAccountPaths(msg: SolanaGetAccountPaths): SolanaAccountPath[] {
    // Solana Mobile Seed Vault uses 4-level paths: m/44'/501'/<account>'/0'
    const slip44 = 501; // Solana
    return [
      {
        addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0x80000000 + 0],
      },
    ];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  solanaNextAccountPath(_msg: SolanaAccountPath): SolanaAccountPath | undefined {
    return undefined;
  }

  async solanaSignTx(msg: SolanaSignTx): Promise<SolanaSignedTx | null> {
    const transaction = solanaBuildTransaction(msg, this.pubkey);
    const serializedTx = Buffer.from(transaction.serialize()).toString("base64");

    const result = await this.messageHandler.signTransaction(serializedTx);
    if (!result.success || !result.signedTransaction) {
      throw new Error(result.error ?? "Failed to sign transaction");
    }

    return {
      serialized: result.signedTransaction,
      signatures: [result.signedTransaction],
    };
  }

  async solanaSendTx(msg: SolanaSignTx): Promise<SolanaTxSignature | null> {
    const transaction = solanaBuildTransaction(msg, this.pubkey);
    const serializedTx = Buffer.from(transaction.serialize()).toString("base64");

    const result = await this.messageHandler.signAndSendTransaction(serializedTx);
    if (!result.success || !result.signature) {
      throw new Error(result.error ?? "Failed to sign and send transaction");
    }

    return { signature: result.signature };
  }

  // NEAR Protocol support
  async nearGetAddress(msg: NearGetAddress): Promise<string | null> {
    // NEAR uses a different derivation path than Solana
    // Convert the addressNList to BIP32 URI format (e.g., "bip32:/m/44'/397'/0'")
    try {
      const derivationPath = "bip32:/" + nearAddressNListToBIP32(msg.addressNList);
      const cacheKey = `${SeekerHDWallet.CACHE_VERSION}:${derivationPath}`;

      // Check cache first
      const cachedPubkey = this.nearPubkeyCache.get(cacheKey);
      if (cachedPubkey) {
        const publicKey = new SolanaPublicKey(cachedPubkey);
        const hexPublicKey = Buffer.from(publicKey.toBytes()).toString("hex");
        return hexPublicKey;
      }

      // Request NEAR public key using BIP32 URI format
      const result = await this.messageHandler.getPublicKey(derivationPath);
      if (!result.publicKey) {
        throw new Error("Failed to get NEAR public key from Seed Vault");
      }

      // Cache the base58-encoded public key for this derivation path
      this.nearPubkeyCache.set(cacheKey, result.publicKey);

      // Convert base58 public key to hex format for NEAR implicit accounts
      const publicKey = new SolanaPublicKey(result.publicKey);
      const hexPublicKey = Buffer.from(publicKey.toBytes()).toString("hex");
      return hexPublicKey;
    } catch (error) {
      return null;
    }
  }

  nearGetAccountPaths(msg: NearGetAccountPaths): NearAccountPath[] {
    // Try 4-level path with account at level 2: m/44'/397'/<account>'/0'
    const slip44 = 397; // NEAR
    return [
      {
        addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0x80000000 + 0],
      },
    ];
  }

  nearNextAccountPath(msg: NearAccountPath): NearAccountPath | undefined {
    const addressNList = msg.addressNList;
    if (!addressNList || addressNList.length < 3) return undefined;

    const accountIdx = addressNList[2] & 0x7fffffff;

    // TEMPORARY: Only support account #0 until we verify derivation works properly
    // Once we confirm different derivation paths return different addresses from Seed Vault,
    // we can enable multi-account support
    if (accountIdx >= 0) {
      return undefined;
    }

    const nextAccountIdx = accountIdx + 1;
    return {
      addressNList: [0x80000000 + 44, 0x80000000 + 397, 0x80000000 + nextAccountIdx],
    };
  }

  async nearSignTx(msg: NearSignTx): Promise<NearSignedTx | null> {
    // NEAR transactions need to be hashed before signing
    // The Borsh-serialized transaction bytes are in msg.txBytes
    const txHash = crypto.createHash("sha256").update(Buffer.from(msg.txBytes)).digest();
    const txHashBase64 = txHash.toString("base64");

    // Convert the addressNList to BIP32 URI format (e.g., "bip32:/m/44'/397'/0'")
    const derivationPath = "bip32:/" + nearAddressNListToBIP32(msg.addressNList);

    const result = await this.messageHandler.signMessage(txHashBase64, derivationPath);
    if (!result.signature) {
      throw new Error("Failed to sign NEAR transaction");
    }

    // The signature from Seed Vault is base64-encoded Ed25519 signature bytes
    const signatureBytes = Buffer.from(result.signature, "base64");
    const signature = signatureBytes.toString("hex");

    // Get the public key for this derivation path
    const cachedPubkey = this.nearPubkeyCache.get(derivationPath) || this.pubkey;

    return {
      signature,
      publicKey: cachedPubkey,
    };
  }

  // SUI Protocol support
  suiGetAccountPaths(msg: SuiGetAccountPaths): SuiAccountPath[] {
    // Solana Mobile Seed Vault uses 4-level paths for all chains (matching Solana structure)
    // m/44'/784'/<account>'/0' instead of standard 5-level m/44'/784'/<account>'/0'/0'
    const slip44 = 784; // SUI
    return [
      {
        addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0x80000000 + 0],
      },
    ];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  suiNextAccountPath(_msg: SuiAccountPath): SuiAccountPath | undefined {
    // Only support account #0, same as NEAR until multi-chain derivation is verified
    return undefined;
  }

  async suiGetAddress(msg: SuiGetAddress): Promise<string | null> {
    // SUI uses derivation path m/44'/784'/x'/0'/0' (all hardened)
    try {
      const derivationPath = "bip32:/" + addressNListToBIP32(msg.addressNList);
      const cacheKey = `${SeekerHDWallet.CACHE_VERSION}:${derivationPath}`;

      // Check cache first
      const cachedPubkey = this.suiPubkeyCache.get(cacheKey);
      if (cachedPubkey) {
        const publicKey = new SolanaPublicKey(cachedPubkey);
        const pubkeyBytes = Buffer.from(publicKey.toBytes());
        const suiPublicKey = new Ed25519PublicKey(pubkeyBytes);
        const suiAddress = suiPublicKey.toSuiAddress();
        return suiAddress;
      }

      // Request SUI public key using BIP32 URI format
      const result = await this.messageHandler.getPublicKey(derivationPath);
      if (!result.publicKey) {
        throw new Error("Failed to get SUI public key from Seed Vault");
      }

      // Cache the base58-encoded public key
      this.suiPubkeyCache.set(cacheKey, result.publicKey);

      // Convert base58 public key to Ed25519PublicKey and derive SUI address
      const publicKey = new SolanaPublicKey(result.publicKey);
      const pubkeyBytes = Buffer.from(publicKey.toBytes());
      const suiPublicKey = new Ed25519PublicKey(pubkeyBytes);
      const suiAddress = suiPublicKey.toSuiAddress();
      return suiAddress;
    } catch (error) {
      return null;
    }
  }

  async suiSignTx(msg: SuiSignTx): Promise<SuiSignedTx | null> {
    // Following native wallet pattern: hash intent message with BLAKE2b-256 before signing
    // Native: packages/hdwallet-native/src/crypto/isolation/adapters/sui.ts:59-77
    const blake2b = await createBLAKE2b(256);
    blake2b.init();
    blake2b.update(msg.intentMessageBytes);
    const messageHash = blake2b.digest("binary");

    const messageHashBase64 = Buffer.from(messageHash).toString("base64");

    const derivationPath = "bip32:/" + addressNListToBIP32(msg.addressNList);
    const signResult = await this.messageHandler.signMessage(messageHashBase64, derivationPath);

    if (!signResult.signature) {
      throw new Error("Failed to sign SUI transaction");
    }

    const signatureBytes = Buffer.from(signResult.signature, "base64");

    // Ed25519 signatures MUST be exactly 64 bytes
    if (signatureBytes.length !== 64) {
      throw new Error(`Invalid signature length for SUI: got ${signatureBytes.length} bytes, expected 64`);
    }

    const signature = signatureBytes.toString("hex");

    const cacheKey = `${SeekerHDWallet.CACHE_VERSION}:${derivationPath}`;
    const cachedPubkey = this.suiPubkeyCache.get(cacheKey) || this.pubkey;
    const publicKey = new SolanaPublicKey(cachedPubkey);
    const pubkeyBytes = publicKey.toBytes();

    // Ed25519 public keys MUST be exactly 32 bytes
    if (pubkeyBytes.length !== 32) {
      throw new Error(`Invalid public key length for SUI: got ${pubkeyBytes.length} bytes, expected 32`);
    }

    const pubkeyHex = Buffer.from(pubkeyBytes).toString("hex");

    return {
      signature,
      publicKey: pubkeyHex,
    };
  }

  // TON Protocol support
  tonGetAccountPaths(msg: TonGetAccountPaths): TonAccountPath[] {
    // Solana Mobile Seed Vault requires 4-level paths for all chains: m/44'/607'/<account>'/0'
    // This matches Solana (m/44'/501'/<account>'/0'), NEAR (m/44'/397'/<account>'/0'), and SUI patterns
    const slip44 = 607; // TON
    return [
      {
        addressNList: [0x80000000 + 44, 0x80000000 + slip44, 0x80000000 + msg.accountIdx, 0x80000000 + 0],
      },
    ];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tonNextAccountPath(_msg: TonAccountPath): TonAccountPath | undefined {
    // Only support account #0, same as NEAR/SUI until multi-chain derivation is verified
    return undefined;
  }

  async tonGetAddress(msg: TonGetAddress): Promise<string | null> {
    try {
      // Use raw input path directly (same pattern as NEAR which works)
      const derivationPath = "bip32:/" + addressNListToBIP32(msg.addressNList);
      const cacheKey = `${SeekerHDWallet.CACHE_VERSION}:${derivationPath}`;

      // Check cache first
      const cachedPubkey = this.tonPubkeyCache.get(cacheKey);
      if (cachedPubkey) {
        const publicKey = new SolanaPublicKey(cachedPubkey);
        const pubkeyBytes = Buffer.from(publicKey.toBytes());

        // Ed25519 public keys must be exactly 32 bytes
        if (pubkeyBytes.length !== 32) {
          throw new Error(`Bad public key size for TON: expected 32 bytes, got ${pubkeyBytes.length} bytes`);
        }

        // Derive TON wallet address from public key
        // TON uses WalletV4 contract by default with wallet_id 0x29a9a317 for mainnet
        const wallet = WalletContractV4.create({ workchain: 0, publicKey: pubkeyBytes });
        // Use non-bounceable format (UQ prefix) as the default for display
        const tonAddress = wallet.address.toString({ bounceable: false });
        return tonAddress;
      }

      // Request TON public key using BIP32 URI format
      const result = await this.messageHandler.getPublicKey(derivationPath);
      if (!result.publicKey) {
        throw new Error("Failed to get TON public key from Seed Vault");
      }

      // Cache the base58-encoded public key
      this.tonPubkeyCache.set(cacheKey, result.publicKey);

      // Convert base58 public key to bytes and derive TON wallet address
      const publicKey = new SolanaPublicKey(result.publicKey);
      const pubkeyBytes = Buffer.from(publicKey.toBytes());

      // Ed25519 public keys must be exactly 32 bytes
      if (pubkeyBytes.length !== 32) {
        throw new Error(`Bad public key size for TON: expected 32 bytes, got ${pubkeyBytes.length} bytes`);
      }

      // Derive TON wallet address from public key
      // TON uses WalletV4 contract by default with wallet_id 0x29a9a317 for mainnet
      const wallet = WalletContractV4.create({ workchain: 0, publicKey: pubkeyBytes });
      // Use non-bounceable format (UQ prefix) as the default for display
      const tonAddress = wallet.address.toString({ bounceable: false });
      return tonAddress;
    } catch (error) {
      return null;
    }
  }

  async tonSignTx(msg: TonSignTx): Promise<TonSignedTx | null> {
    const derivationPath = "bip32:/" + addressNListToBIP32(msg.addressNList);

    const cacheKey = `${SeekerHDWallet.CACHE_VERSION}:${derivationPath}`;
    let pubkeyBase58 = this.tonPubkeyCache.get(cacheKey);
    if (!pubkeyBase58) {
      const pubResult = await this.messageHandler.getPublicKey(derivationPath);
      if (!pubResult.publicKey) throw new Error("Failed to get TON public key from Seed Vault");
      pubkeyBase58 = pubResult.publicKey;
      this.tonPubkeyCache.set(cacheKey, pubkeyBase58);
    }
    const pubkeyBytes = Buffer.from(new SolanaPublicKey(pubkeyBase58).toBytes());

    // Ed25519 public keys must be exactly 32 bytes
    if (pubkeyBytes.length !== 32) {
      throw new Error(`Bad public key size for TON signing: expected 32 bytes, got ${pubkeyBytes.length} bytes`);
    }

    const seedVaultSigner = async (message: Cell): Promise<Buffer> => {
      const hash = message.hash();
      const hashBase64 = hash.toString("base64");

      const result = await this.messageHandler.signMessage(hashBase64, derivationPath);

      if (!result.signature) {
        throw new Error("Failed to sign TON transaction via Seed Vault - no signature returned");
      }

      const signatureBuffer = Buffer.from(result.signature, "base64");

      // Ed25519 signatures must be exactly 64 bytes
      if (signatureBuffer.length !== 64) {
        throw new Error(`Bad signature size for TON signing: expected 64 bytes, got ${signatureBuffer.length} bytes`);
      }

      return signatureBuffer;
    };

    const wallet = WalletContractV4.create({ workchain: 0, publicKey: pubkeyBytes });
    const walletAddress = wallet.address.toString({ bounceable: true });

    if (msg.rawMessages && msg.rawMessages.length > 0) {
      const seqno = msg.seqno ?? 0;
      const expireAt = msg.expireAt ?? Math.floor(Date.now() / 1000) + 300;

      const internalMessages = msg.rawMessages.map((rawMsg) => {
        const destination = Address.parse(rawMsg.targetAddress);
        const value = BigInt(rawMsg.sendAmount);

        let body: Cell;
        if (rawMsg.payload && rawMsg.payload.length > 0) {
          const payloadBuffer = Buffer.from(rawMsg.payload, "hex");
          body = Cell.fromBoc(payloadBuffer)[0];
        } else {
          body = beginCell().endCell();
        }

        let init: { code: Cell; data: Cell } | undefined;
        if (rawMsg.stateInit && rawMsg.stateInit.length > 0) {
          const stateInitBuffer = Buffer.from(rawMsg.stateInit, "hex");
          const stateInitCell = Cell.fromBoc(stateInitBuffer)[0];
          const stateInitSlice = stateInitCell.beginParse();
          const hasCode = stateInitSlice.loadBit();
          const hasData = stateInitSlice.loadBit();
          if (hasCode && hasData) {
            init = {
              code: stateInitSlice.loadRef(),
              data: stateInitSlice.loadRef(),
            };
          }
        }

        return internal({
          to: destination,
          value,
          bounce: true,
          body,
          init,
        });
      });

      const createTransfer = wallet.createTransfer.bind(wallet);

      const transfer = await createTransfer({
        seqno,
        signer: seedVaultSigner,
        messages: internalMessages,
        sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
        timeout: expireAt,
      });

      const externalMessage = beginCell()
        .store(
          storeMessage({
            info: {
              type: "external-in",
              dest: wallet.address,
              importFee: BigInt(0),
            },
            init: seqno === 0 ? wallet.init : null,
            body: transfer,
          })
        )
        .endCell();

      const bocBase64 = externalMessage.toBoc().toString("base64");

      if (!bocBase64 || bocBase64.length === 0) {
        throw new Error("[TON] Generated BOC is empty!");
      }

      const result = {
        signature: "",
        serialized: bocBase64,
      };

      return result;
    }

    if (!msg.message) {
      throw new Error("Either message or rawMessages must be provided");
    }

    const messageJson = new TextDecoder().decode(msg.message);
    let txParams: {
      from: string;
      to: string;
      value: string;
      seqno: number;
      expireAt: number;
      memo?: string;
      contractAddress?: string;
      type?: string;
    };
    try {
      txParams = JSON.parse(messageJson);
    } catch (error) {
      throw new Error(
        `Failed to parse TON transaction message: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const seqno = txParams.seqno ?? msg.seqno ?? 0;
    const expireAt = txParams.expireAt ?? msg.expireAt ?? Math.floor(Date.now() / 1000) + 300;
    const destination = Address.parse(txParams.to);

    // Verify wallet address matches the sender address
    const fromAddressNormalized = Address.parse(txParams.from).toString({ bounceable: true });
    if (walletAddress !== fromAddressNormalized) {
      throw new Error(`Address mismatch: wallet ${walletAddress} does not match sender ${fromAddressNormalized}`);
    }

    let internalMessage: MessageRelaxed;
    if (txParams.type === "jetton_transfer" && txParams.contractAddress) {
      const jettonWalletAddress = Address.parse(txParams.contractAddress);
      const forwardPayload = txParams.memo
        ? beginCell().storeUint(0, 32).storeStringTail(txParams.memo).endCell()
        : beginCell().endCell();

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
        .endCell();

      internalMessage = internal({
        to: jettonWalletAddress,
        value: BigInt(100000000),
        bounce: true,
        body: jettonTransferBody,
      });
    } else {
      internalMessage = internal({
        to: destination,
        value: BigInt(txParams.value),
        bounce: false,
        body: txParams.memo
          ? beginCell().storeUint(0, 32).storeStringTail(txParams.memo).endCell()
          : beginCell().endCell(),
      });
    }

    const createTransferSimple = wallet.createTransfer.bind(wallet);

    const transfer = await createTransferSimple({
      seqno,
      signer: seedVaultSigner,
      messages: [internalMessage],
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      timeout: expireAt,
    });

    const externalMessage = beginCell()
      .store(
        storeMessage({
          info: {
            type: "external-in",
            dest: wallet.address,
            importFee: BigInt(0),
          },
          init: seqno === 0 ? wallet.init : null,
          body: transfer,
        })
      )
      .endCell();

    const bocBase64 = externalMessage.toBoc().toString("base64");

    if (!bocBase64 || bocBase64.length === 0) {
      throw new Error("[TON] Generated BOC is empty!");
    }

    const result = {
      signature: "",
      serialized: bocBase64,
    };

    return result;
  }
}
