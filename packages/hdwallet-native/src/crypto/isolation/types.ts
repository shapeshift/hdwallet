import {
  InstanceOf,
  Literal,
  Never,
  Number as Num,
  Object as Obj,
  Runtype,
  Static,
  String as Str,
  Unknown,
} from "funtypes";

const positive = Num.withConstraint((x) => x > 0 || `expected ${x} to be positive`, { name: "Positive" });
export type Positive = Static<typeof positive>;
export const Positive: typeof positive = positive;

const negative = Num.withConstraint((x) => x < 0 || `expected ${x} to be negative`, { name: "Negative" });
export type Negative = Static<typeof negative>;
export const Negative: typeof negative = negative;

const nonNegative = Num.withConstraint((x) => x >= 0 || `expected ${x} to be non-negative`, { name: "NonNegative" });
export type NonNegative = Static<typeof nonNegative>;
export const NonNegative: typeof nonNegative = nonNegative;

const nonPositive = Num.withConstraint((x) => x <= 0 || `expected ${x} to be non-positive`, { name: "NonPositive" });
export type NonPositive = Static<typeof nonPositive>;
export const NonPositive: typeof nonPositive = nonPositive;

export const integer = Num.withConstraint((x) => Number.isSafeInteger(x) || `expected ${x} to be an integer`, {
  name: "Integer",
});
export type Integer = Static<typeof integer>;
export const Integer: typeof integer = integer;

const positiveInteger = Integer.And(Positive);
export type PositiveInteger = Static<typeof positiveInteger>;
export const PositiveInteger: typeof positiveInteger = positiveInteger;

const negativeInteger = Integer.And(Negative);
export type NegativeInteger = Static<typeof negativeInteger>;
export const NegativeInteger: typeof negativeInteger = negativeInteger;

const nonPositiveInteger = Integer.And(NonPositive);
export type NonPositiveInteger = Static<typeof nonPositiveInteger>;
export const NonPositiveInteger: typeof nonPositiveInteger = nonPositiveInteger;

const nonNegativeInteger = Integer.And(NonNegative);
export type NonNegativeInteger = Static<typeof nonNegativeInteger>;
export const NonNegativeInteger: typeof nonNegativeInteger = nonNegativeInteger;

const uint = NonNegativeInteger.Or(Never);
export type Uint = Static<typeof uint>;
export const Uint: typeof uint = uint;

const uint32 = Num.withConstraint(
  (x) => x === (x & 0xffffffff) >>> 0 || `expected ${x} to be an unsigned 32-bit integer.`,
  { name: "Uint32" }
);
export type Uint32 = Static<typeof uint32>;
export const Uint32: typeof uint32 = uint32;

const uint16 = Num.withConstraint((x) => x === (x & 0xffff) >>> 0 || `expected ${x} to be an unsigned 16-bit integer`, {
  name: "Uint16",
});
export type Uint16 = Static<typeof uint16>;
export const Uint16: typeof uint16 = uint16;

const uint8 = Num.withConstraint((x) => x === (x & 0xff) >>> 0 || `expected ${x} to be an unsigned 8-bit integer`, {
  name: "Uint8",
});
export type Uint8 = Static<typeof uint8>;
export const Uint8: typeof uint8 = uint8;

function boundedUintBase<T extends NonNegativeInteger>(max: T) {
  return Object.assign(
    Uint.withConstraint((x) => x <= max || `expected ${x} to be less than or equal to ${max}`, {
      name: `BoundedUint(${max})`,
    }),
    { max }
  );
}
export type BoundedUint<T extends NonNegativeInteger> = Static<typeof Uint> & { max: T };
const boundedUintStatic = {};
const boundedUint = Object.assign(boundedUintBase, boundedUintStatic);
export const BoundedUint: typeof boundedUint = boundedUint;

function boundedStringBase<T extends RegExp>(regex: T) {
  return Object.assign(
    Str.withConstraint((x) => regex.test(x) || `expected ${x} to match regex ${regex}`, {
      name: `BoundedString(${regex})`,
    }),
    { regex }
  );
}
export type BoundedString<T extends RegExp> = Static<typeof Str> & { regex: T };
const boundedStringStatic = {};
const boundedString = Object.assign(boundedStringBase, boundedStringStatic);
export const BoundedString: typeof boundedString = boundedString;

export function assertType<T extends Runtype<unknown>>(rt: T, value: unknown): asserts value is Static<T> {
  rt.assert(value);
}

export function checkType<T extends Runtype<unknown>>(rt: T, value: unknown): Static<T> {
  assertType(rt, value);
  return value;
}

// export function ParseWorkaround<T, U extends Runtype<T>>(rt: U) {
//     return Unknown.withParser({
//         test: rt,
//         parse(value: any): Result<T> {
//             return (rt.test(value) ? {success: true, value} : rt.safeParse(value));
//         },
//     }) as unknown as U
// }

type Ternary<T, U, V> = T extends undefined ? V : unknown extends T ? V : U;
function byteArrayBase<T extends NonNegativeInteger | undefined = undefined>(length?: T) {
  length === undefined || NonNegativeInteger.assert(length);
  const indefinite = InstanceOf(Uint8Array);
  const literalConstraint = length !== undefined ? Literal(length) : Unknown;
  const definite = InstanceOf(Uint8Array).And(
    Obj({
      length: literalConstraint as Literal<T>,
    })
  );
  return (length === undefined ? indefinite : definite) as Ternary<T, typeof definite, typeof indefinite>;
}
export type ByteArray<T extends NonNegativeInteger | undefined = undefined> = Uint8Array &
  (T extends undefined ? unknown : { length: T });
const byteArrayStatic = {
  equal(lhs: ByteArray, rhs: ByteArray): boolean {
    const length = lhs.length;
    if (length !== rhs.length) return false;
    for (let i = 0; i < length; i++) {
      if (lhs[i] !== rhs[i]) return false;
    }
    return true;
  },
};
const byteArray = Object.assign(byteArrayBase, byteArrayStatic);
export const ByteArray: typeof byteArray = byteArray;

function bigEndianIntegerBase<T extends NonNegativeInteger | undefined = undefined>(length?: T) {
  return ByteArray(length);
}

export type BigEndianInteger<T extends NonNegativeInteger | undefined> = ByteArray<T>;
const bigEndianIntegerStatic = {
  isHigh: <T extends number>(x: BigEndianInteger<T>) => (x[0] & 0x80) !== 0,
  isOdd: <T extends number>(x: BigEndianInteger<T>) => (x[x.length - 1] & 1) === 1,
};
const bigEndianInteger = Object.assign(bigEndianIntegerBase, ByteArray, bigEndianIntegerStatic);
export const BigEndianInteger: typeof bigEndianInteger = bigEndianInteger;

export function safeBufferFrom<T extends NonNegativeInteger | undefined = undefined>(
  input: ByteArray<T>
): Buffer & ByteArray<T> {
  if (Buffer.isBuffer(input)) return input;
  input = checkType(ByteArray(), input) as ByteArray<T>;
  return Buffer.alloc(input.byteLength).fill(input) as Buffer & ByteArray<T>;
}
