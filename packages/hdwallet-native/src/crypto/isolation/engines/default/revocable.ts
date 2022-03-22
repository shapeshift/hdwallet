import * as core from "@shapeshiftoss/hdwallet-core";

const _Set = Set;
const _freeze = Object.freeze.bind(Object);
const _revocable = Proxy.revocable.bind(Proxy);

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

export const revocable = _freeze(<T extends object>(x: T, addRevoker: (revoke: () => void) => void) => {
  const universalProxyHandler = (pseudoTarget: object) =>
    new Proxy(
      {},
      {
        get(_, p) {
          return (_t: any, p2: any, r: any) => {
            switch (p) {
              case "get": {
                const out = Reflect.get(pseudoTarget, p2, r);
                if (typeof out === "function") return out.bind(x);
                return out;
              }
              case "getOwnPropertyDescriptor": {
                const out = Reflect.getOwnPropertyDescriptor(pseudoTarget, p2);
                if (out) out.configurable = true;
                return out;
              }
              case "isExtensible":
                return true;
              case "preventExtensions":
                return false;
              default:
                return (Reflect as any)[p](pseudoTarget, p2, r);
            }
          };
        },
      }
    );
  const { proxy, revoke } = _revocable({} as T, universalProxyHandler(x));
  addRevoker(revoke);
  return proxy;
});

export interface Revocable {
  revoke(): void;
  addRevoker(x: () => void): void;
}

export const Revocable = _freeze(<T extends core.Constructor>(x: T) => {
  const out = _freeze(
    // eslint-disable-next-line @typescript-eslint/no-shadow
    class Revocable extends x {
      readonly #revokers: Set<() => void> = new _Set();
      #revoked = false;

      readonly revoke = () => {
        this.#revoked = true;
        this.#revokers.forEach((revoker) => {
          try {
            revoker();
          } catch {
            // revoker errors get swallowed.
          }
        });
        this.#revokers.clear();
      };

      readonly addRevoker = (revoker: () => void) => {
        if (this.#revoked) {
          try {
            revoker();
          } catch {
            // revoker errors get swallowed.
          }
        } else {
          this.#revokers.add(revoker);
        }
      };
    }
  );
  _freeze(out.prototype);
  return out;
});
