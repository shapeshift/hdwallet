import { ByteArray, Uint32 } from "../../types";
import * as Digest from "../digest";
import { CurvePoint, RecoverableSignature, Signature } from "./types";

export interface ECDSAKey {
  getPublicKey(): Promise<CurvePoint>;

  // Signatures MUST use a determinsitic nonce generation algorithm, which SHOULD be the one specified in RFC6979. The
  // counter parameter is used to generate multiple distinct signatures over the same message, and SHOULD be included as
  // additional entropy in the nonce generation algorithm (typically after convertion to a 32-byte big-endian integer).
  //
  // This can be used, for example, to find a signature whose r-value does not have the MSB set (i.e. a lowR signature),
  // which can be encoded in DER format with one less byte. If an implementation does not support the use of the counter
  // value, it MUST return undefined rather than perform a signing operation which ignores it.
  ecdsaSign(digestAlgorithm: null, message: ByteArray<32>): Promise<NonNullable<Signature>>;
  ecdsaSign(
    digestAlgorithm: null,
    message: ByteArray<32>,
    counter: Uint32
  ): Promise<NonNullable<Signature> | undefined>;
  ecdsaSign(digestAlgorithm: Digest.AlgorithmName<32>, message: Uint8Array): Promise<NonNullable<Signature>>;
  ecdsaSign(
    digestAlgorithm: Digest.AlgorithmName<32>,
    message: Uint8Array,
    counter: Uint32
  ): Promise<NonNullable<Signature> | undefined>;
}

export interface ECDSARecoverableKey extends ECDSAKey {
  ecdsaSignRecoverable(digestAlgorithm: null, message: ByteArray<32>): Promise<NonNullable<RecoverableSignature>>;
  ecdsaSignRecoverable(
    digestAlgorithm: null,
    message: ByteArray<32>,
    counter: Uint32
  ): Promise<NonNullable<RecoverableSignature> | undefined>;
  ecdsaSignRecoverable(
    digestAlgorithm: Digest.AlgorithmName<32>,
    message: Uint8Array
  ): Promise<NonNullable<RecoverableSignature>>;
  ecdsaSignRecoverable(
    digestAlgorithm: Digest.AlgorithmName<32>,
    message: Uint8Array,
    counter: Uint32
  ): Promise<NonNullable<RecoverableSignature> | undefined>;
}

export interface ECDHKey {
  getPublicKey(): Promise<CurvePoint>;

  // Calculates a shared secret field element according to the ECDH key-agreement scheme specified in SEC 1 section 3.3.2,
  // encoded as a 32-byte big-endian integer. The output of this function is not uniformly distributed, and is not safe to
  // use as a cryptographic key by itself.
  //
  // A key derivation function is required to convert the output into a usable key; a plain, unkeyed cryptographic hash
  // function such as SHA-256 is typically used for this purpose.
  ecdh(publicKey: CurvePoint, digestAlgorithm?: Digest.AlgorithmName<32>): Promise<NonNullable<ByteArray<32>>>;
  ecdhRaw?(publicKey: CurvePoint): Promise<NonNullable<CurvePoint>>;
}
