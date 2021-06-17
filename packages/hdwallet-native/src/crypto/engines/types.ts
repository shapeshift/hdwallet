export interface Pbkdf2Params {
  iterations: number;
  keyLen?: number;
}

export interface ScryptParams {
  iterations: number;
  blockSize: number;
  parallelism: number;
  keyLength: number;
}

export enum DigestAlgorithm {
  SHA256,
  SHA512,
}

export interface CryptoEngine {
  decrypt(data: ArrayBuffer, key: ArrayBuffer, iv: ArrayBuffer): Promise<ArrayBuffer>;
  digest(algorithm: DigestAlgorithm, data: ArrayBuffer): Promise<ArrayBuffer>;
  encrypt(data: ArrayBuffer, key: ArrayBuffer, iv: ArrayBuffer): Promise<ArrayBuffer>;
  hmac(value: ArrayBuffer, key: ArrayBuffer): Promise<ArrayBuffer>;
  pbkdf2(password: ArrayBuffer, salt: ArrayBuffer, options?: Pbkdf2Params): Promise<ArrayBuffer>;
  randomBytes(size: number): Promise<ArrayBuffer>;
  scrypt(password: ArrayBuffer, salt: ArrayBuffer, params: ScryptParams): Promise<ArrayBuffer>;
}
