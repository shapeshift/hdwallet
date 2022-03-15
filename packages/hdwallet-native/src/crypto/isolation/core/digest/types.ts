import { Contract, Enum, Literal, Never, Object as Obj, Runtype } from "funtypes";

import { ByteArray, NonNegativeInteger } from "../../types";
import { checkType } from "../../types";
import { _initializeAlgorithms, AlgorithmLength } from "./algorithms";

// These names come from the keys on the AlgorithmLength object. We'd prefer not
// to repeat them here, which means we have to build the Enum object in a way that
// type inference can't follow. Luckily, because the names are statically known,
// we can assert the type even though it can't be inferred.
function algorithmNameBase<L extends NonNegativeInteger | undefined = undefined>(
  length?: L
): Enum<{ [N in AlgorithmName<L>]: N }> {
  return Enum(
    `AlgorithmName(${length ?? ""})`,
    Object.entries(AlgorithmLength)
      .filter((x) => length === undefined || length === x[1])
      .map((x) => x[0])
      .reduce((a, x) => Object.assign(a, { [x]: x }), {})
  ) as any;
}
// This can't be inline (or use generic type bounds) because it needs to distributed over the members of a union type.
type algorithmNameInner<K, L> = K extends keyof typeof AlgorithmLength
  ? typeof AlgorithmLength[K] extends L
    ? K
    : never
  : never;
// The generic parameter is optional, and will restrict the type to algorithm names whose entries on AlgorithmLength match the specified length.
export type AlgorithmName<L extends NonNegativeInteger | undefined = undefined> = L extends undefined
  ? keyof typeof AlgorithmLength
  : algorithmNameInner<keyof typeof AlgorithmLength, L>;
const algorithmNameStatic = {
  forEach(callbackfn: (value: AlgorithmName, index: number, array: AlgorithmName[]) => void, thisarg?: any) {
    (Object.keys(AlgorithmName().enumObject) as AlgorithmName[]).forEach(callbackfn, thisarg);
  },
};
const algorithmName = Object.assign(algorithmNameBase, algorithmNameBase(), algorithmNameStatic);
export const AlgorithmName: typeof algorithmName = algorithmName;

function specificUnverifiedDigest<N extends AlgorithmName = AlgorithmName>(name: N): Runtype<UnverifiedDigest<N>> {
  return Obj({
    preimage: ByteArray(),
    algorithm: Literal(name),
  }).And(ByteArray(AlgorithmLength[name])) as any;
}

function unverifiedDigestBase<N extends AlgorithmName = AlgorithmName>(name?: N): Runtype<UnverifiedDigest<N>> {
  if (name !== undefined) return specificUnverifiedDigest(name);
  return (Object.keys(AlgorithmName.enumObject) as AlgorithmName[]).reduce(<T>(a: Runtype<T>, x: AlgorithmName) => {
    return a.Or(specificUnverifiedDigest(x));
  }, Never as Runtype<any>);
}
// This can't be inline (or use generic type bounds) because it needs to distributed over the members of a union type.
type unverifiedDigestInner<N> = N extends keyof typeof AlgorithmLength
  ? ByteArray<typeof AlgorithmLength[N]> & { preimage: ByteArray; algorithm: N }
  : never;
// The generic parameter is optional, and will restrict the type to digests with matching length/name combinations.
type UnverifiedDigest<N extends AlgorithmName = AlgorithmName> = unverifiedDigestInner<N>;
const unverifiedDigestStatic = {};
const unverifiedDigest = Object.assign(unverifiedDigestBase, ByteArray, unverifiedDigestStatic);
// We need the UnverifiedDigest type to enable us to build the Algorithm contract without
// trying to recursively verify verified verifications. That said, it's not exported; only
// actual algorithm functions we're wrapping should be able to use it.
const UnverifiedDigest: typeof unverifiedDigest = unverifiedDigest;

export type Digest<N extends AlgorithmName> = UnverifiedDigest<N>;
const digestStatic = {};

// We use UnverifiedDigest instead of Digest in the contract because the result is implicitly trusted.
function algorithmBase<N extends AlgorithmName>(name: N) {
  return Contract([ByteArray()], UnverifiedDigest(name));
}
export type Algorithm<N extends AlgorithmName = AlgorithmName> = (_: ByteArray) => Digest<N>;
const algorithmStatic = {};
const algorithm = Object.assign(algorithmBase, algorithmStatic);
// This isn't exported; only the registration function below should be using it.
const Algorithm: typeof algorithm = algorithm;

export const Algorithms = (() => {
  const algorithms = {} as {
    [Property in keyof typeof AlgorithmLength]: Algorithm<Property>;
  };

  _initializeAlgorithms(<N extends AlgorithmName>(name: N, fn: Algorithm<N>) => {
    AlgorithmName.assert(name);
    if (name in algorithms) throw new Error(`digest algorithm implementation already provided for ${name}`);
    algorithms[name] = Algorithm(name).enforce((x: ByteArray) => {
      const out = checkType(ByteArray(AlgorithmLength[name]), fn(x)) as Partial<UnverifiedDigest<N>>;
      out.preimage = x;
      out.algorithm = name;
      return checkType(UnverifiedDigest(name), out);
    }) as Algorithm<any>;
  });

  Object.freeze(algorithms);
  AlgorithmName.forEach((x) => {
    if (!algorithms[x]) throw new Error(`digest algorithm implementation missing for ${x}`);
  });

  return algorithms;
})();

function digestBase(name?: AlgorithmName) {
  return UnverifiedDigest(name).withConstraint(
    (x) =>
      ByteArray.equal(x, Algorithms[x.algorithm](x.preimage)) ||
      `expected ${x} to equal the ${x.algorithm} digest of ${x.preimage}`,
    { name: `Digest(${name})` }
  );
}

const digest = Object.assign(digestBase, UnverifiedDigest, digestStatic);
export const Digest: typeof digest = digest;
