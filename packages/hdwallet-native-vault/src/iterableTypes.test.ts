import * as ta from "type-assertions";

import type {
  Iterable as BetterIterable,
  IterableIterator as BetterIterableIterator,
  AsyncIterable as BetterAsyncIterable,
  AsyncIterableIterator as BetterAsyncIterableIterator,
} from "./iterableTypes";

declare const _t: unique symbol;
type T = { [_t]: never } | typeof _t;
declare const _u: unique symbol;
type U = { [_u]: never } | typeof _u;
declare const _v: unique symbol;
type V = { [_v]: never } | typeof _v;

ta.assert<ta.Extends<T, {}>>();
ta.assert<ta.Not<ta.Extends<{}, T>>>();
ta.assert<ta.Not<ta.Extends<{ foo: "bar" }, T>>>();
ta.assert<ta.Not<ta.Extends<T, U>>>();
ta.assert<ta.Not<ta.Extends<T, V>>>();
ta.assert<ta.Not<ta.Extends<U, T>>>();
ta.assert<ta.Not<ta.Extends<V, T>>>();

ta.assert<ta.Extends<U, {}>>();
ta.assert<ta.Not<ta.Extends<{}, U>>>();
ta.assert<ta.Not<ta.Extends<{ foo: "bar" }, U>>>();
ta.assert<ta.Not<ta.Extends<U, T>>>();
ta.assert<ta.Not<ta.Extends<U, V>>>();
ta.assert<ta.Not<ta.Extends<T, U>>>();
ta.assert<ta.Not<ta.Extends<V, U>>>();

ta.assert<ta.Extends<V, {}>>();
ta.assert<ta.Not<ta.Extends<{}, V>>>();
ta.assert<ta.Not<ta.Extends<{ foo: "bar" }, V>>>();
ta.assert<ta.Not<ta.Extends<V, T>>>();
ta.assert<ta.Not<ta.Extends<V, U>>>();
ta.assert<ta.Not<ta.Extends<T, V>>>();
ta.assert<ta.Not<ta.Extends<U, V>>>();

ta.assert<ta.Equal<BetterIterable<T>, Iterable<T>>>();
ta.assert<ta.Not<ta.Equal<BetterIterable<T, U, V>, Iterable<T>>>>();

ta.assert<ta.Extends<BetterIterableIterator<T>, IterableIterator<T>>>();
ta.assert<ta.Extends<BetterIterableIterator<T, U, V>, Iterator<T, U, V>>>();

ta.assert<ta.Equal<BetterAsyncIterable<T>, AsyncIterable<T>>>();
ta.assert<ta.Not<ta.Equal<BetterAsyncIterable<T, U, V>, AsyncIterable<T>>>>();
ta.assert<ta.Extends<BetterAsyncIterableIterator<T>, AsyncIterableIterator<T>>>();
ta.assert<ta.Not<ta.Extends<BetterAsyncIterableIterator<T, U, V>, AsyncIterableIterator<T>>>>();

it("compiles", ()=>{
  expect(true).toBeTruthy()
})
