export type FunctionOnly<T> = T extends (...args: infer R) => infer S ? (...args: R) => S : unknown
export type ConstructorOnly<T> = T extends { new (...args: infer R): infer S } ? { new (...args: R): S } : unknown
export type Indexable = Record<PropertyKey, unknown>

/**
 * Type guard for things that might have properties. Useful to make TypeScript happy
 * when you want to check if an object of unknown type has a particular property set.
 * @example
 * try {
 *   foo();
 * } catch (e: unknown) {
 *   // Not allowed because there's no index signature for `unknown`:
 *   // if (e.bar === "baz") return "foobar";
 *   if (isIndexable(e) && e.bar === "baz") return "foobar";
 *   throw e;
 * }
 * @example
 * isIndexable({}) === true
 * @example
 * isIndexable(() => {}) === true
 * @example
 * isIndexable(Object.create(null)) === true
 * @example
 * isIndexable(String("foo")) === true
 * @example
 * isIndexable(null) === false
 * @example
 * isIndexable(3.14) === false
 * @example
 * isIndexable("foo") === false
 */
export function isIndexable(x: unknown): x is Indexable {
  return x !== null && ["object", "function"].includes(typeof x)
}

export function assume<T>(x: unknown): asserts x is T { }

export function bind<T extends (...args: any) => any>(fn: T, thisArg: ThisParameterType<T>): OmitThisParameter<T> {
  return new Proxy(fn, {
    apply(target: T, _: any, argArray: any[]) {
      return target.apply(thisArg, argArray)
    }
  }) as OmitThisParameter<T>
}

export function getPropertyDescriptor(target: object | null, propertyKey: PropertyKey): PropertyDescriptor | undefined {
  if (!target || !Reflect.has(target, propertyKey)) return undefined
  return Reflect.getOwnPropertyDescriptor(target, propertyKey) ?? getPropertyDescriptor(Reflect.getPrototypeOf(target), propertyKey)
}

export function isConstructor<T extends Function>(x: T): x is T & (T extends (...args: infer P) => infer R ? { new (...args: P): R } : { new (...args: any): unknown }) {
  try {
    Reflect.construct(new Proxy(x, {
      construct() {
        return {}
      }
    }), [])
    return true
  } catch {
    return false
  }
}
