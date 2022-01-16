import { overlay } from "./overlay"
import { Constructor } from "../utils"

const _Set = Set
const _freeze = Object.freeze.bind(Object)

export const revocable = _freeze(<T extends object>(x: T, addRevoker: (revoke: () => void) => void): T => {
  return overlay({}, x, {
    addRevoker,
    bind: true,
    capture: true,
    readonly: true
  })
})

export interface Revocable {
  revoke(): void
  addRevoker(x: () => void): void
}

export const Revocable = _freeze(<T extends Constructor>(x: T) => {
  const out = _freeze(class Revocable extends x {
    readonly #revokers: Set<() => void> = new _Set()
    #revoked = false

    constructor(...args: any[]) {
      super(...args)
      Object.defineProperty(this, "revoke", {
        ...Object.getOwnPropertyDescriptor(this, "revoke"),
        enumerable: false
      })
      Object.defineProperty(this, "addRevoker", {
        ...Object.getOwnPropertyDescriptor(this, "addRevoker"),
        enumerable: false
      })
    }

    readonly revoke = () => {
      this.#revoked = true;
      this.#revokers.forEach(x => {
        try {
          x()
        } catch { }
      });
      this.#revokers.clear();
    }

    readonly addRevoker = (x: () => void) => {
      if (this.#revoked) {
        try {
          x()
        } catch { }
      } else {
        this.#revokers.add(x);
      }
    }
  });
  _freeze(out.prototype);
  return out;
})
