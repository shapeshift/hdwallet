import * as core from "@shapeshiftoss/hdwallet-core";

import type {
  IterableIterator as BetterIterableIterator,
  AsyncIterableIterator as BetterAsyncIterableIterator,
} from "./iterableTypes";

export interface IAsyncMap<K, V> {
  readonly size: Promise<number>;
  get<T extends V = V>(key: K): Promise<T | undefined>;
  has(key: K): Promise<boolean>;
  keys(): Promise<AsyncIterableIterator<K>>;
  values(): Promise<AsyncIterableIterator<V>>;
  entries(): Promise<AsyncIterableIterator<[K, V]>>;

  clear(): Promise<void>;
  delete(key: K): Promise<boolean>;
  set(key: K, value: V): Promise<this>;
}

export function isPromiseLike<T = unknown>(x: unknown): x is PromiseLike<T> {
  return core.isIndexable(x) && typeof x.then === "function";
}

export function hasStringTag(x: unknown): x is { [Symbol.toStringTag]: string } {
  return core.isIndexable(x) && Symbol.toStringTag in x && typeof x[Symbol.toStringTag as any] === "string";
}

export function getStringTag(x: unknown): string {
  return /^\[object (.*)\]$/.exec(Object.prototype.toString.call(x))![1];
}

export function selfResolved<T extends {}>(x: T): Omit<T, keyof Promise<T>> & Promise<T> {
  if (isPromiseLike(x)) {
    core.assume<Promise<T>>(x);
    return x;
  }
  const promise = Promise.resolve(x);
  const overlay: Promise<T> = {
    then<TResult1 = T>(
      onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null
    ): Promise<TResult1> {
      return promise.then(onfulfilled);
    },
    catch(): Promise<T> {
      return promise;
    },
    finally(onfinally?: (() => void) | undefined | null): Promise<T> {
      return promise.finally(onfinally);
    },
    get [Symbol.toStringTag](): string {
      if (hasStringTag(x)) return x[Symbol.toStringTag];
      return getStringTag(x);
    },
  };
  const out = core.overlay(x, overlay, { bind: true, hide: Reflect.ownKeys(overlay) });
  core.assume<Omit<T, keyof Promise<T>>>(out); // Seems strange that the typings don't give us this already?
  return out;
}

export function selfIterable<
  T extends Iterator<A, B, C>,
  A = T extends Iterator<infer R, any, any> ? R : never,
  B = T extends Iterator<any, infer R, any> ? R : never,
  C = T extends Iterator<any, any, infer R> ? R : never
>(x: T): T & BetterIterableIterator<A, B, C> {
  if (isIterable(x)) {
    core.assume<{
      [Symbol.iterator](this: T): T & BetterIterableIterator<A, B, C>;
    }>(x);
    return x;
  }
  const overlay = {
    [Symbol.iterator](this: T): T & BetterIterableIterator<A, B, C> {
      core.assume<BetterIterableIterator<A, B, C>>(this);
      return this;
    },
  };
  const out = core.overlay(x, overlay, { bind: "lower" });
  core.assume<T>(out)
  return out;
}

export function selfAsyncIterableIterator<
  T extends AsyncIterator<A, B, C>,
  A = T extends AsyncIterator<infer R, any, any> ? R : never,
  B = T extends AsyncIterator<any, infer R, any> ? R : never,
  C = T extends AsyncIterator<any, any, infer R> ? R : never
>(x: T): T & BetterAsyncIterableIterator<A, B, C> {
  return core.overlay(
    {
      [Symbol.asyncIterator](this: T): T & BetterAsyncIterableIterator<A, B, C> {
        core.assume<BetterAsyncIterableIterator<A, B, C>>(this);
        return this;
      },
    },
    x,
    { bind: "upper" }
  );
}

export function toHybridIterator<T, TReturn = any, TNext = undefined, AsyncOnly extends boolean = false>(
  x: Iterator<T, TReturn, TNext> | AsyncIterator<T, TReturn, TNext>,
  asyncOnly?: AsyncOnly
): (AsyncOnly extends true ? unknown : Iterator<T, TReturn, TNext> & BetterIterableIterator<T, TReturn, TNext>) &
  BetterAsyncIterableIterator<T, TReturn, TNext> {
  if (asyncOnly) {
    const out: BetterAsyncIterableIterator<T, TReturn, TNext> = {
      next(...args: [] | [TNext]): Promise<IteratorResult<T, TReturn>> {
        const out = x.next(...args);
        if (isPromiseLike<IteratorResult<T, TReturn>>(out)) return Promise.resolve(out);
        return selfResolved(out);
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
    // This assumption is required because asyncOnly can be true even if AsyncOnly can't be statically narrowed that far.
    return out as AsyncOnly extends true ? typeof out : never;
  }
  core.assume<Iterator<T, TReturn, TNext>>(x);
  const boundNext = (...args: [] | [TNext]) => x.next(...args) as Omit<IteratorResult<T, TReturn>, keyof Promise<T>>;
  const out: BetterIterableIterator<T, TReturn, TNext> & BetterAsyncIterableIterator<T, TReturn, TNext> = {
    next(...args: [] | [TNext]): IteratorResult<T, TReturn> & Promise<IteratorResult<T, TReturn>> {
      const out = selfResolved(boundNext(...args));
      return out as any;
    },
    [Symbol.iterator]() {
      return this;
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
  return out;
}

export function isIterable<T = unknown>(x: unknown): x is Iterable<T> {
  return core.isIndexable(x) && Symbol.iterator in x && typeof x[Symbol.iterator as any] === "function";
}

export function isIterator<T = unknown>(x: unknown): x is Iterator<T> | AsyncIterator<T> {
  return core.isIndexable(x) && "next" in x && typeof x["next"] === "function";
}

export function isAsyncIterable<T = unknown>(x: unknown): x is AsyncIterable<T> {
  return core.isIndexable(x) && Symbol.asyncIterator in x && typeof x[Symbol.asyncIterator as any] === "function";
}

export function toAsyncIterableIterator<T = unknown>(
  x: Iterator<T> | Iterable<T> | AsyncIterator<T> | AsyncIterable<T>
): AsyncIterableIterator<T> {
  if (isIterator<T>(x)) {
    core.assume<Iterator<T> | AsyncIterator<T>>(x);
    return toHybridIterator(x, true);
  }
  if (isAsyncIterable(x)) return selfAsyncIterableIterator(x[Symbol.asyncIterator]());
  return toHybridIterator(x[Symbol.iterator]());
}

export async function fromAsyncIterable<T>(
  x: Iterator<T> | Iterable<T> | AsyncIterable<T> | AsyncIterator<T>
): Promise<Array<T>> {
  const out: Array<T> = [];
  for await (const i of toAsyncIterableIterator(x)) out.push(i);
  return out;
}

export class AsyncMap<K = any, V = any> extends core.Revocable(class {}) implements IAsyncMap<K, V> {
  readonly #inner: Map<K, V>;

  constructor(inner?: Map<K, V>) {
    super();
    this.#inner = core.revocable(inner ?? new Map<K, V>(), (x) => this.addRevoker(x));
  }

  static async create<K, V>(map: Map<K, V>): Promise<AsyncMap<K, V>>;
  static async create<K, V>(iterable: AsyncIterable<readonly [K, V]>): Promise<AsyncMap<K, V>>;
  static async create<K, V>(iterable: Iterable<readonly [K, V]>): Promise<AsyncMap<K, V>>;
  static async create<K, V>(entries?: readonly (readonly [K, V])[] | null): Promise<AsyncMap<K, V>>;
  static async create<K, V>(
    x?: Map<K, V> | AsyncIterable<readonly [K, V]> | Iterable<readonly [K, V]> | readonly (readonly [K, V])[] | null
  ): Promise<AsyncMap<K, V>> {
    if (!x) return new AsyncMap<K, V>(new Map<K, V>());
    if (x instanceof Map) return new AsyncMap<K, V>(x);
    if (isIterable(x)) return new AsyncMap<K, V>(new Map<K, V>(x));
    if (isAsyncIterable(x)) {
      return new AsyncMap<K, V>(new Map<K, V>(await fromAsyncIterable(x[Symbol.asyncIterator]())));
    }
    return new AsyncMap<K, V>(new Map<K, V>(x));
  }

  get size(): Promise<number> {
    return (async () => {
      return this.#inner.size;
    })();
  }
  async get<T extends V = V>(key: K): Promise<T | undefined> {
    return this.#inner.get(key) as T | undefined;
  }
  async has(key: K): Promise<boolean> {
    return this.#inner.has(key);
  }
  async keys(): Promise<AsyncIterableIterator<K>> {
    return toAsyncIterableIterator(this.#inner.keys());
  }
  async values(): Promise<AsyncIterableIterator<V>> {
    return toAsyncIterableIterator(this.#inner.values());
  }
  async entries(): Promise<AsyncIterableIterator<[K, V]>> {
    return toAsyncIterableIterator(this.#inner.entries());
  }
  async clear(): Promise<void> {
    this.#inner.clear();
  }
  async delete(key: K): Promise<boolean> {
    return this.#inner.delete(key);
  }
  async set(key: K, value: V): Promise<this> {
    this.#inner.set(key, value);
    return this;
  }
}
