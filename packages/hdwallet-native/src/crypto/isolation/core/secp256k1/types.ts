import * as core from "@shapeshiftoss/hdwallet-core"
import * as ethers from "ethers"
import { Literal, Object as Obj, Static, Union } from "funtypes";
import * as tinyecc from "tiny-secp256k1";

import * as Digest from "../digest";
import { BigEndianInteger, ByteArray, Uint32, checkType, safeBufferFrom, assertType } from "../../types";
import { ECDSAKey, ECDSARecoverableKey } from "./interfaces";

const fieldElementBase = BigEndianInteger(32).withConstraint(
    x => tinyecc.isPrivate(safeBufferFrom(x)) || `expected ${x} to be within the order of the curve`,
    {name: "FieldElement"},
);
export type FieldElement = Static<typeof fieldElementBase>;
const fieldElementStatic = {};
const fieldElement = Object.assign(fieldElementBase, BigEndianInteger, fieldElementStatic);
export const FieldElement: typeof fieldElement = fieldElement;

const compressedPointBase = ByteArray(33).And(Obj({
    0: Literal(0x02).Or(Literal(0x03)),
})).withConstraint(
    p => FieldElement.test(p.slice(1)) || `expected ${p}.x to be within the order of the curve`,
    {name: "CompressedPoint.x"},
);
export type CompressedPoint = Static<typeof compressedPointBase>;
const compressedPointStatic = {
    from: (p: CurvePoint): CompressedPoint => {
        return (p.length === 33 ? p : CompressedPoint.fromUncompressed(checkType(UncompressedPoint, p)));
    },
    fromUncompressed: (p: UncompressedPoint): CompressedPoint => {
        const out = new Uint8Array(33);
        out[0] = (UncompressedPoint.yIsOdd(p) ? 0x03 : 0x02);
        out.set(UncompressedPoint.x(p), 1);
        CompressedPoint.assert(out);
        return out;
    },
    x: (p: CompressedPoint): FieldElement => { return checkType(FieldElement, p.slice(1)); },
    yIsOdd: (p: CompressedPoint): boolean => { return p[0] === 0x03; }
};
const compressedPoint = Object.assign(compressedPointBase, ByteArray, compressedPointStatic);
export const CompressedPoint: typeof compressedPoint = compressedPoint;

const uncompressedPointBase = ByteArray(65).And(Obj({
    0: Literal(0x04),
})).withConstraint(
    p => FieldElement.test(p.slice(1, 33)) || `expected ${p}.x to be within the order of the curve`,
    {name: "UncompressedPoint.x"},
).withConstraint(
    p => {
        if (!FieldElement.test(p.slice(33, 65))) return `expected ${p}.y to be within the order of the curve`;
        const pBuf = Buffer.from(p);
        if (!ByteArray.equal(tinyecc.pointCompress(tinyecc.pointCompress(pBuf, true), false), pBuf)) return `expected ${p} to be on the curve`;
        return true;
    },
    {name: "UncompressedPoint.y"}
);
export type UncompressedPoint = Static<typeof uncompressedPointBase>;
const uncompressedPointStatic = {
    from: (p: CurvePoint): UncompressedPoint => {
        return (p.length === 65 ? p : UncompressedPoint.fromCompressed(checkType(CompressedPoint, p)));
    },
    fromCompressed: (p: CompressedPoint): UncompressedPoint => {
        return checkType(UncompressedPoint, tinyecc.pointCompress(Buffer.from(p), false));
    },
    x: (p: UncompressedPoint): FieldElement => { return checkType(FieldElement, p.slice(1, 33)); },
    y: (p: UncompressedPoint): FieldElement => { return checkType(FieldElement, p.slice(33, 65)); },
    yIsOdd: (p: UncompressedPoint): boolean => { return FieldElement.isOdd(UncompressedPoint.y(p)); },
};
const uncompressedPoint = Object.assign(uncompressedPointBase, ByteArray, uncompressedPointStatic);
export const UncompressedPoint: typeof uncompressedPoint = uncompressedPoint;

const curvePointBase = CompressedPoint.Or(UncompressedPoint);
export type CurvePoint = CompressedPoint | UncompressedPoint;
const curvePointStatic = {
    x: (p: CurvePoint): FieldElement => (p[0] === 0x04 ? UncompressedPoint.x(p) : CompressedPoint.x(p)),
    yIsOdd: (p: CurvePoint): boolean => (p[0] === 0x04 ? UncompressedPoint.yIsOdd(p) : CompressedPoint.yIsOdd(p)),
    // Equivalent to CompressedPoint.equal(CompressedPoint.from(lhs), CompressedPoint.from(rhs)), but avoids allocations
    equal: (lhs: CurvePoint, rhs: CurvePoint) => CurvePoint.yIsOdd(lhs) === CurvePoint.yIsOdd(rhs) && FieldElement.equal(CurvePoint.x(lhs), CurvePoint.x(rhs)),
};
const curvePoint = Object.assign(curvePointBase, curvePointStatic);
export const CurvePoint: typeof curvePoint = curvePoint;

const recoveryParamBase = Union(Literal(0), Literal(1), Literal(2), Literal(3));
export type RecoveryParam = Static<typeof recoveryParamBase>;
const recoveryParamStatic = {};
const recoveryParam = Object.assign(recoveryParamBase, recoveryParamStatic);
export const RecoveryParam: typeof recoveryParam = recoveryParam;

const messageWithPreimageBase = ByteArray(32).And(Digest.Digest());
export type MessageWithPreimage = Static<typeof messageWithPreimageBase>;
const messageWithPreimageStatic = {};
const messageWithPreimage = Object.assign(messageWithPreimageBase, ByteArray, messageWithPreimageStatic);
export const MessageWithPreimage: typeof messageWithPreimage = messageWithPreimage;

const messageBase = MessageWithPreimage.Or(ByteArray());
export type Message = Static<typeof messageBase>;
const messageStatic = {};
const message = Object.assign(messageBase, ByteArray, messageWithPreimageStatic, messageStatic);
export const Message: typeof message = message;

const signatureBase = ByteArray(64).withConstraint(
    x => FieldElement.test(x.slice(0, 32)) || `expected ${x}.r to be within the order of the curve`,
    {name: "Signature.r"},
).withConstraint(
    x => FieldElement.test(x.slice(32, 64)) || `expected ${x}.s to be within the order of the curve`,
    {name: "Signature.s"},
);
export type Signature = Static<typeof signatureBase>;
const signatureStatic = {
    r: (x: Signature): FieldElement => { return checkType(FieldElement, x.slice(0, 32)); },
    s: (x: Signature): FieldElement => { return checkType(FieldElement, x.slice(32, 64)); },
    isLowR: (x: Signature): boolean => { return !FieldElement.isHigh(Signature.r(x)); },
    isLowS: (x: Signature): boolean => { return !FieldElement.isHigh(Signature.s(x)); },
    isCanonical: (x: Signature): boolean => { return Signature.isLowR(x) && Signature.isLowS(x); },
    signCanonically: async (x: ECDSAKey, digestAlgorithm: Digest.AlgorithmName<32> | null, message: Uint8Array, counter?: Uint32): Promise<Signature> => {
        assertType(ByteArray(), message);
        counter === undefined || Uint32.assert(counter);
        for (let i = counter; i === undefined || i < (counter ?? 0) + 128; i = (i ?? -1) + 1) {
            const sig = await (async () => {
              if (digestAlgorithm === null) {
                assertType(ByteArray(32), message);
                return i === undefined ? await x.ecdsaSign(digestAlgorithm, message) : await x.ecdsaSign(digestAlgorithm, message, i);
              } else {
                return i === undefined ? await x.ecdsaSign(digestAlgorithm, message) : await x.ecdsaSign(digestAlgorithm, message, i);
              }
            })();
            if (sig === undefined) break;
            //TODO: do integrated lowS correction
            if (Signature.isCanonical(sig)) return sig;
        }
        // This is cryptographically impossible (2^-128 chance) if the key is implemented correctly.
        throw new Error(`Unable to generate canonical signature with public key ${x} over message ${message}; is your key implementation broken?`);
    },
    verify: (x: Signature, digestAlgorithm: Digest.AlgorithmName<32> | null, message: Uint8Array, publicKey: CurvePoint): boolean => {
        const msgOrDigest = digestAlgorithm === null ? checkType(ByteArray(32), message) : Digest.Algorithms[digestAlgorithm](checkType(ByteArray(), message));
        return tinyecc.verify(Buffer.from(msgOrDigest), Buffer.from(publicKey), Buffer.from(x));
    },
};
const signature = Object.assign(signatureBase, ByteArray, signatureStatic);
export const Signature: typeof signature = signature;

const recoverableSignatureBase = ByteArray(65).And(Obj({
    64: RecoveryParam,
})).withConstraint(
    x => Signature.test(x.slice(0, 64)) || `expected ${x}.sig to be a valid signature`,
    {name: "Signature"},
);
export type RecoverableSignature = Static<typeof recoverableSignatureBase>;
const recoverableSignatureStatic = {
    from: (x: Signature, recoveryParam: RecoveryParam): RecoverableSignature => {
      return checkType(RecoverableSignature, core.compatibleBufferConcat([x, new Uint8Array([recoveryParam])]));
    },
    fromSignature: (x: Signature, digestAlgorithm: Digest.AlgorithmName<32> | null, message: Uint8Array, publicKey: CurvePoint): RecoverableSignature => {
      for (let recoveryParam: RecoveryParam = 0; recoveryParam < 4; recoveryParam++) {
        const out = RecoverableSignature.from(x, recoveryParam);
        if (!CurvePoint.equal(publicKey, RecoverableSignature.recoverPublicKey(out, digestAlgorithm, message))) continue;
        return out;
      }
      throw new Error(`couldn't find recovery parameter producing public key ${publicKey} for signature ${x} over message ${message}`);
    },
    sig: (x: RecoverableSignature): Signature => checkType(Signature, x.slice(0, 64)),
    recoveryParam: (x: RecoverableSignature): RecoveryParam => checkType(RecoveryParam, x[64]),
    isLowRecoveryParam: (x: RecoverableSignature) => [0, 1].includes(RecoverableSignature.recoveryParam(x)),
    isCanonical: (x: RecoverableSignature): boolean => Signature.isCanonical(checkType(Signature, RecoverableSignature.sig(x))) && RecoverableSignature.isLowRecoveryParam(x),
    signCanonically: async (x: ECDSAKey, digestAlgorithm: Digest.AlgorithmName<32> | null, message: Uint8Array, counter?: Uint32): Promise<RecoverableSignature> => {
        const publicKey = await x.getPublicKey();
        assertType(ByteArray(), message);
        counter === undefined || Uint32.assert(counter);

        const isIndexable = (x: unknown): x is Record<string, unknown> => x !== null && ["object", "function"].includes(typeof x);
        const isECDSARecoverableKey = (x: ECDSAKey): x is ECDSARecoverableKey => isIndexable(x) && "ecdsaSignRecoverable" in x && typeof x.ecdsaSignRecoverable === "function";

        const ecdsaSignRecoverable = isECDSARecoverableKey(x) ? async (digestAlgorithm: Digest.AlgorithmName<32> | null, message: Uint8Array, counter?: Uint32) => {
          if (digestAlgorithm === null) {
            assertType(ByteArray(32), message);
            return counter === undefined ? await x.ecdsaSignRecoverable(digestAlgorithm, message) : await x.ecdsaSignRecoverable(digestAlgorithm, message, counter);
          } else {
            return counter === undefined ? await x.ecdsaSignRecoverable(digestAlgorithm, message) : await x.ecdsaSignRecoverable(digestAlgorithm, message, counter);
          }
        } : async (digestAlgorithm: Digest.AlgorithmName<32> | null, message: Uint8Array, counter?: Uint32) => {
          const sig = await Signature.signCanonically(x, digestAlgorithm, message, counter);
          if (sig === undefined) return undefined;
          return RecoverableSignature.fromSignature(sig, digestAlgorithm, message, publicKey);
        };

        // Technically, this may waste cycles; if Signature.signCanonically grinds the counter to find a canonical signature which then 
        // ends up to have a non-canonical recovery parameter, those values will all be re-ground. However, signatures can have
        // non-canonical recovery parameters only with negligible probability, so optimization for that case would be silly.
        for (let i = counter; i === undefined || i < (counter ?? 0) + 128; i = (i ?? -1) + 1) {
            const recoverableSig = await ecdsaSignRecoverable(digestAlgorithm, message, i);
            if (recoverableSig === undefined) break;
            //TODO: do integrated lowS correction
            if (RecoverableSignature.isCanonical(recoverableSig)) return recoverableSig;
        }
        // This is cryptographically impossible (2^-128 chance) if the key is implemented correctly.
        throw new Error(`Unable to generate canonical recoverable signature with public key ${Buffer.from(publicKey).toString("hex")} over message ${Buffer.from(message).toString("hex")}; is your key implementation broken?`);
    },
    recoverPublicKey: (x: RecoverableSignature, digestAlgorithm: Digest.AlgorithmName<32> | null, message: Uint8Array): CurvePoint => {
      // TODO: do this better
      const msgOrDigest = digestAlgorithm === null ? checkType(ByteArray(32), message) : Digest.Algorithms[digestAlgorithm](checkType(ByteArray(), message));
      const sig = RecoverableSignature.sig(x);
      const recoveryParam = RecoverableSignature.recoveryParam(x);
      const ethSig = core.compatibleBufferConcat([sig, Buffer.from([recoveryParam])]);
      const ethRecovered = ethers.utils.recoverPublicKey(msgOrDigest, ethers.utils.splitSignature(ethSig));
      return checkType(UncompressedPoint, Buffer.from(ethRecovered.slice(2), "hex"));
    },
    r: (x: RecoverableSignature): FieldElement => Signature.r(RecoverableSignature.sig(x)),
    s: (x: RecoverableSignature): FieldElement => Signature.s(RecoverableSignature.sig(x)),
    isLowR: (x: RecoverableSignature): boolean => Signature.isLowR(RecoverableSignature.sig(x)),
    isLowS: (x: RecoverableSignature): boolean => Signature.isLowS(RecoverableSignature.sig(x)),
    verify: (x: RecoverableSignature, digestAlgorithm: Digest.AlgorithmName<32> | null, message: Uint8Array, publicKey: CurvePoint): boolean => {
      return Signature.verify(RecoverableSignature.sig(x), digestAlgorithm, message, publicKey);
    },
};
const recoverableSignature = Object.assign(
  recoverableSignatureBase,
  recoverableSignatureStatic
);
export const RecoverableSignature: typeof recoverableSignature = recoverableSignature;
