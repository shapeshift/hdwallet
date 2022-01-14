export type FunctionOnly<T> = T extends (...args: infer R) => infer S ? (...args: R) => S : unknown
export type ConstructorOnly<T> = T extends { new (...args: infer R): infer S } ? { new (...args: R): S } : unknown

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
