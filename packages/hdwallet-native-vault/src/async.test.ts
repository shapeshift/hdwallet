import * as _ from "lodash";

import * as mocks from "./test/mockIterators.skip";
import * as tests from "./test/testIterators.skip";
import {
  selfResolved,
  selfIterable,
  selfAsyncIterableIterator,
  toHybridIterator,
  isIterable,
  isAsyncIterable,
  isIterator,
  toAsyncIterableIterator,
  fromAsyncIterable,
} from "./asyncMap";

describe("selfResolved", () => {
  const foo = { bar: "baz" };
  const x = selfResolved(foo);

  it("should match the argument's serialization", async () => {
    expect(JSON.stringify(x)).toEqual(JSON.stringify(x));
  });

  it("should deep-equal the argument", async () => {
    expect(_.isEqual(x, foo)).toBeTruthy();
    expect(x).toMatchInlineSnapshot(`
      Object {
        "bar": "baz",
      }
    `);
    expect(x).toEqual(foo);
  });

  it("should resolve to the argument", async () => {
    await expect(x).resolves.toBe(foo);
  });
});

describe("selfIterable", () => {
  [tests.isIterable, tests.isNotAsyncIterable, tests.isIterator, tests.isNotAsyncIterator].forEach((x) =>
    x(() => selfIterable(mocks.mockIterator()), mocks.list)
  );
});

describe("selfAsyncIterableIterator", () => {
  [tests.isNotIterable, tests.isAsyncIterable, tests.isNotIterator, tests.isAsyncIterator].forEach((x) =>
    x(() => selfAsyncIterableIterator(mocks.mockAsyncIterator()), mocks.list)
  );
});

describe("toHybridIterator", () => {
  [tests.isIterable, tests.isAsyncIterable, tests.isIterator, tests.isAsyncIterator].forEach((x) =>
    x(() => toHybridIterator(mocks.mockIterator()), mocks.list)
  );
});

describe("isIterable", () => {
  it("works", async () => {
    expect(isIterable(mocks.mockIterator())).toBe(false);
    expect(isIterable(mocks.mockIterable())).toBe(true);
    expect(isIterable(mocks.mockAsyncIterator())).toBe(false);
    expect(isIterable(mocks.mockAsyncIterable())).toBe(false);
    expect(isIterable(mocks.mockHybridIterator())).toBe(false);
    expect(isIterable(mocks.mockHybridIterable())).toBe(true);
  });
});

describe("isAsyncIterable", () => {
  it("works", async () => {
    expect(isAsyncIterable(mocks.mockIterator())).toBe(false);
    expect(isAsyncIterable(mocks.mockIterable())).toBe(false);
    expect(isAsyncIterable(mocks.mockAsyncIterator())).toBe(false);
    expect(isAsyncIterable(mocks.mockAsyncIterable())).toBe(true);
    expect(isAsyncIterable(mocks.mockHybridIterator())).toBe(false);
    expect(isAsyncIterable(mocks.mockHybridIterable())).toBe(true);
  });
});

describe("isIterator", () => {
  it("works", async () => {
    expect(isIterator(mocks.mockIterator())).toBe(true);
    expect(isIterator(mocks.mockIterable())).toBe(false);
    expect(isIterator(mocks.mockAsyncIterator())).toBe(true);
    expect(isIterator(mocks.mockAsyncIterable())).toBe(false);
    expect(isIterator(mocks.mockHybridIterator())).toBe(true);
    expect(isIterator(mocks.mockHybridIterable())).toBe(true);
  });
});

describe("toAsyncIterableIterator", () => {
  describe("works on a plain Iterator", () => {
    [tests.isNotIterable, tests.isAsyncIterable, tests.isIterator, tests.isAsyncIterator].forEach((x) =>
      x(() => toAsyncIterableIterator(mocks.mockIterator()), mocks.list)
    );
  });
  describe("works on a plain Iterable", () => {
    [tests.isIterable, tests.isAsyncIterable, tests.isIterator, tests.isAsyncIterator].forEach((x) =>
      x(() => toAsyncIterableIterator(mocks.mockIterable()), mocks.list)
    );
  });
  describe("works on a plain AsyncIterator", () => {
    [tests.isNotIterable, tests.isAsyncIterable, tests.isNotIterator, tests.isAsyncIterator].forEach((x) =>
      x(() => toAsyncIterableIterator(mocks.mockAsyncIterator()), mocks.list)
    );
  });
  describe("works on a plain AsyncIterable", () => {
    [tests.isNotIterable, tests.isAsyncIterable, tests.isNotIterator, tests.isAsyncIterator].forEach((x) =>
      x(() => toAsyncIterableIterator(mocks.mockAsyncIterable()), mocks.list)
    );
  });
});

describe("fromAsyncIterable", () => {
  it("works on a plain Iterator", async () => {
    expect(await fromAsyncIterable(mocks.mockIterator())).toStrictEqual(mocks.list);
  });
  it("works on a plain Iterable", async () => {
    expect(await fromAsyncIterable(mocks.mockIterable())).toStrictEqual(mocks.list);
  });
  it("works on a plain AsyncIterator", async () => {
    expect(await fromAsyncIterable(mocks.mockAsyncIterator())).toStrictEqual(mocks.list);
  });
  it("works on a plain AsyncIterable", async () => {
    expect(await fromAsyncIterable(mocks.mockAsyncIterable())).toStrictEqual(mocks.list);
  });
});
