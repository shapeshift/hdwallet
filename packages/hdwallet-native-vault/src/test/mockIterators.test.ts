import * as mocks from "./mockIterators.skip"
import * as tests from "./testIterators.skip"

describe("mockIterator", () => {
  [
    tests.isNotIterable,
    tests.isNotAsyncIterable,
    tests.isIterator,
    tests.isNotAsyncIterator
  ].forEach(x => x(mocks.mockIterator, mocks.list))
});

describe("mockIterable", () => {
  [
    tests.isIterable,
    tests.isNotAsyncIterable,
    tests.isNotIterator,
    tests.isNotAsyncIterator
  ].forEach(x => x(mocks.mockIterable, mocks.list))
});

describe("mockAsyncIterator", () => {
  [
    tests.isNotIterable,
    tests.isNotAsyncIterable,
    tests.isNotIterator,
    tests.isAsyncIterator
  ].forEach(x => x(mocks.mockAsyncIterator, mocks.list))
});

describe("mockAsyncIterable", () => {
  [
    tests.isNotIterable,
    tests.isAsyncIterable,
    tests.isNotIterator,
    tests.isNotAsyncIterator
  ].forEach(x => x(mocks.mockAsyncIterable, mocks.list))
});

describe("mockHybridIterator", () => {
  [
    tests.isNotIterable,
    tests.isNotAsyncIterable,
    tests.isIterator,
    tests.isAsyncIterator
  ].forEach(x => x(mocks.mockHybridIterator, mocks.list))
});

describe("mockHybridIterable", () => {
  [
    tests.isIterable,
    tests.isAsyncIterable,
    tests.isIterator,
    tests.isAsyncIterator
  ].forEach(x => x(mocks.mockHybridIterable, mocks.list))
});
