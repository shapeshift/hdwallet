/*
Proxy handler invariants (per MDN):
  apply
    The target must be a callable itself. That is, it must be a function object. 
  construct
    The result must be an Object.
  defineProperty
    A property cannot be added, if the target object is not extensible.
    A property cannot be added as or modified to be non-configurable, if it does not exists as a non-configurable own property of the target object.
    A property may not be non-configurable, if a corresponding configurable property of the target object exists.
    If a property has a corresponding target object property then Object.defineProperty(target, prop, descriptor) will not throw an exception.
    In strict mode, a false return value from the defineProperty() handler will throw a TypeError exception.
  deleteProperty
    A property cannot be deleted, if it exists as a non-configurable own property of the target object.
  get
    The value reported for a property must be the same as the value of the corresponding target object property if the target object property is a non-writable, non-configurable own data property.
    The value reported for a property must be undefined if the corresponding target object property is a non-configurable own accessor property that has undefined as its [[Get]] attribute.
  getOwnPropertyDescriptor
    getOwnPropertyDescriptor() must return an object or undefined.
    A property cannot be reported as non-existent, if it exists as a non-configurable own property of the target object.
    A property cannot be reported as non-existent, if it exists as an own property of the target object and the target object is not extensible.
    A property cannot be reported as existent, if it does not exists as an own property of the target object and the target object is not extensible.
    A property cannot be reported as non-configurable, if it does not exists as an own property of the target object or if it exists as a configurable own property of the target object.
    The result of Object.getOwnPropertyDescriptor(target) can be applied to the target object using Object.defineProperty() and will not throw an exception.
  getPrototypeOf
    getPrototypeOf() method must return an object or null.
    If target is not extensible, Object.getPrototypeOf(proxy) method must return the same value as Object.getPrototypeOf(target).
  has
    A property cannot be reported as non-existent, if it exists as a non-configurable own property of the target object.
    A property cannot be reported as non-existent, if it exists as an own property of the target object and the target object is not extensible.
  isExtensible
    Object.isExtensible(proxy) must return the same value as Object.isExtensible(target). 
  ownKeys
    The result of ownKeys() must be an array.
    The type of each array element is either a String or a Symbol.
    The result List must contain the keys of all non-configurable own properties of the target object.
    If the target object is not extensible, then the result List must contain all the keys of the own properties of the target object and no other values.
  preventExtensions
    Object.preventExtensions(proxy) only returns true if Object.isExtensible(proxy) is false.
  set
    Return true to indicate that assignment succeeded.
    If the set() method returns false, and the assignment happened in strict-mode code, a TypeError will be thrown.
  setPrototypeOf
    If target is not extensible, the prototype parameter must be the same value as Object.getPrototypeOf(target). 
*/

import { Constructor, isIndexable } from "../utils";
import { ConstructorOnly, bind, FunctionOnly, getPropertyDescriptor, isConstructor } from "./utils";

const _Set = Set;
const _freeze = Object.freeze.bind(Object);
const _revocable = Proxy.revocable.bind(Proxy);

class PseudoFrozenError extends TypeError {}
_freeze(PseudoFrozenError);
_freeze(PseudoFrozenError.prototype);

export type OverlayParams = Partial<{
  addRevoker: (x: () => void) => void;
  bind: boolean | "upper" | "lower";
  capture: boolean;
  frozen: boolean;
  ignore: PropertyKey[];
  readonly: boolean;
  hide: PropertyKey[];
}>;

type ValuesOf<T extends unknown[]> = T extends [infer R, ...infer S]
  ? (R extends PropertyKey ? R : never) | ValuesOf<S>
  : never;

type MixedConstuctors<
  Lower extends {},
  Upper extends {},
  IgnoredProps extends PropertyKey[] = never
> = Lower extends Constructor
  ? Upper extends Constructor
    ? {
        new (...args: ConstructorParameters<Lower> & ConstructorParameters<Upper>): OverlayType<
          InstanceType<Lower>,
          InstanceType<Upper>,
          IgnoredProps
        >;
      }
    : ConstructorOnly<Lower>
  : Upper extends Constructor
  ? ConstructorOnly<Upper>
  : unknown;

type OverlayType<Lower extends {}, Upper extends {}, IgnoredProps extends PropertyKey[] = never> = MixedConstuctors<
  Lower,
  Upper,
  IgnoredProps
> &
  (Upper extends (...args: any) => any ? FunctionOnly<Upper> : FunctionOnly<Lower>) & 
  {
    [K in keyof (Lower & Upper)]: K extends keyof (Omit<Lower, keyof Omit<Upper, ValuesOf<IgnoredProps>>> & Omit<Upper, ValuesOf<IgnoredProps>>) ? (Omit<Lower, keyof Omit<Upper, ValuesOf<IgnoredProps>>> & Omit<Upper, ValuesOf<IgnoredProps>>)[K] : never
  }

const fundamentalPrototypes = Object.freeze(new Set([null, Object.prototype, Function.prototype]));

export function overlay<Lower extends {}, Upper extends {}, IgnoredProps extends PropertyKey[] = never>(
  lower: Lower,
  upper: Upper,
  params?: OverlayParams &
    Partial<{
      ignore: IgnoredProps;
    }>
): OverlayType<Lower, Upper, IgnoredProps>;
export function overlay<L extends {}>(lower: L, upper: undefined, params?: OverlayParams): L;
export function overlay(lower: object, upper: object | undefined, params?: OverlayParams): object {
  const _params = {
    ...params,
    bind: params?.bind ?? true,
    ignore: new Set(params?.ignore),
    hide: new Set(params?.hide),
  };
  let frozen = !!_params.frozen;

  if (!isIndexable(lower)) throw new Error("lower must be an object");
  if (!Object.isExtensible(lower)) throw new TypeError("lower must be extensible");
  if (_params.capture && !isIndexable(upper)) throw new Error(`can't capture if upper is not an object: ${upper}`);

  if (typeof upper === "function" && isConstructor(upper)) {
    ["constructor", "prototype"].forEach((x) => _params.ignore.add(x));
  }

  const ignoreAsUpperPrototype = (obj: object | null) => fundamentalPrototypes.has(obj);

  const overrideProp = (p: PropertyKey) => {
    if (_params.ignore.has(p)) return false;
    for (let obj: object | null = upper ?? null; !ignoreAsUpperPrototype(obj); obj = Reflect.getPrototypeOf(obj!)) {
      if (Object.prototype.hasOwnProperty.call(obj, p)) return true;
    }
    return false;
  };

  const boundPropRevokers = new Set<() => void>();
  const { proxy, revoke } = _revocable(lower, {
    apply(target, thisArg, argumentsList) {
      if (typeof upper === "function") {
        return Reflect.apply(upper, thisArg, argumentsList);
      }
      return Reflect.apply(target as unknown as (...args: any) => any, thisArg, argumentsList);
    },
    construct(target, argumentsList, newTarget): any {
      if (typeof upper === "function" && isConstructor(upper)) {
        const newParams = {
          ..._params,
          ignore: Array.from(_params.ignore.values()),
          hide: Array.from(_params.hide.values()),
        };
        const newUpper = Reflect.construct(upper, argumentsList, upper);
        const newLower =
          typeof target === "function" && isConstructor(target)
            ? Reflect.construct(target, argumentsList, newTarget)
            : typeof newUpper === "function"
            ? function () {}
            : {};
        return overlay(newLower, newUpper, newParams);
      }
      // If it's not constructable, this will throw -- which is the correct behavior
      return Reflect.construct(target as unknown as Function, argumentsList, newTarget);
    },
    get(t, p, r) {
      const from = upper && overrideProp(p) ? upper : t;
      const out = Reflect.get(from, p, _params.bind ? from : r);
      if (_params.bind && typeof out === "function") {
        const bindTarget = ((x) => {
          switch (x) {
            case "upper":
              return upper;
            case "lower":
              return t;
            default:
              return from;
          }
        })(_params.bind);
        const boundProp = bind(out, bindTarget);
        if (!_params.addRevoker) return boundProp;
        return overlay(boundProp, undefined, {
          addRevoker(x) {
            boundPropRevokers.add(x);
          },
          bind: true,
        });
      }
      return out;
    },
    defineProperty(t, p, attributes) {
      if (!attributes.configurable || frozen) {
        const desc = Reflect.getOwnPropertyDescriptor(upper && overrideProp(p) ? upper : t, p);
        if (!desc) return false;
        return (
          (["configurable", "enumerable", "value", "writable", "get", "set"] as const).findIndex(
            (k) => attributes[k] !== desc[k]
          ) === -1
        );
      }
      if (_params.capture || overrideProp(p))
        return isIndexable(upper) ? Reflect.defineProperty(upper, p, attributes) : false;
      if (!_params.readonly) return Reflect.defineProperty(t, p, attributes);
      return false;
    },
    deleteProperty(t, p) {
      if (frozen) return false;
      if (upper && overrideProp(p)) {
        if (Reflect.has(t, p)) {
          if (_params.readonly) return false;
          if (!Reflect.deleteProperty(t, p)) return false;
        }
        return Reflect.deleteProperty(upper, p);
      }
      return !_params.readonly && Reflect.deleteProperty(t, p);
    },
    getOwnPropertyDescriptor(t, p) {
      if (upper && overrideProp(p)) {
        const out = Reflect.getOwnPropertyDescriptor(upper, p);
        if (out) {
          out.configurable = true;
          if (_params.hide.has(p)) out.enumerable = false;
        }
        return out;
      }
      return Reflect.getOwnPropertyDescriptor(t, p);
    },
    getPrototypeOf(t) {
      const upperProto = upper && Reflect.getPrototypeOf(upper);
      const lowerProto = Reflect.getPrototypeOf(t);
      if (!upperProto || ignoreAsUpperPrototype(upperProto)) return lowerProto;
      if (!lowerProto || ignoreAsUpperPrototype(lowerProto)) return upperProto;
      const newParams = {
        ..._params,
        ignore: Array.from(_params.ignore.values()),
        hide: Array.from(_params.hide.values()),
      };
      return overlay(lowerProto, upperProto, newParams);
    },
    has(t, p) {
      return overrideProp(p) || Reflect.has(t, p);
    },
    ownKeys(t) {
      // Filter out any keys which are overridden by the upper object (they may be non-own keys there)
      const lowerOwnKeys = [...Reflect.ownKeys(t)].filter((k) => !(overrideProp(k) && !_params.hide.has(k)));
      const upperOwnKeys = isIndexable(upper) ? [...Reflect.ownKeys(upper).filter((k) => !_params.hide.has(k))] : [];
      return [...new _Set([...lowerOwnKeys, ...upperOwnKeys])];
    },
    preventExtensions(_t) {
      if (!frozen) {
        frozen = true;
        throw new PseudoFrozenError();
      }
      return false;
    },
    set(t, p, v, r) {
      if (frozen) {
        const desc = getPropertyDescriptor(t, p);
        const setter = desc?.set;
        return !!(setter && Reflect.apply(setter, r ?? t, [v]));
      }
      if (_params.capture || overrideProp(p))
        return isIndexable(upper) ? Reflect.set(upper, p, v, _params.bind ? upper : r) : false;
      if (!_params.readonly) return Reflect.set(t, p, v, _params.bind ? t : r);
      return false;
    },
  });
  _params.addRevoker?.(() => {
    revoke();
    boundPropRevokers.forEach((x) => {
      try {
        x();
      } catch {}
    });
    boundPropRevokers.clear();
  });
  return proxy;
}

export const pseudoFreezable = _freeze(
  <T>(x: T, addRevoker?: (x: () => void) => void): T => {
    return overlay(x, undefined, {
      addRevoker,
      bind: true,
    });
  }
);

export const freeze = _freeze(<T>(x: T): T => {
  try {
    _freeze(x);
  } catch (e) {
    if (!(e instanceof PseudoFrozenError)) throw e;
  }
  return x;
});
