export function isIterable(mock: () => any, values: Iterable<any>) {
  const _values = Array.from(values)
  describe("Iterable", () => {
    it("implements the interface", async () => {
      const x = mock();
      expect(Symbol.iterator in x).toBeTruthy();
      expect(x[Symbol.iterator]).toBeInstanceOf(Function);
      expect(typeof x[Symbol.iterator]).toBe("function");
      expect(() => x[Symbol.iterator]()).not.toThrow();
    })
    describe("Symbol.iterator()", () => {
      isIterator(() => mock()[Symbol.iterator](), _values)
    })
  })
}

export function isNotIterable(mock: () => any, values: Iterable<any>) {
  const _values = Array.from(values)
  it("is not Iterable", async () => {
    const x = mock();
    expect(Symbol.iterator in x).toBeFalsy();
    expect(x[Symbol.iterator]).toBeUndefined();
    expect(() => {
      for (const _ of x) { }
    }).toThrowError("is not iterable");
  });
}

export function isAsyncIterable(mock: () => any, values: Iterable<any>) {
  const _values = Array.from(values)
  describe("AsyncIterable", () => {
    it("implements the interface", async () => {
      const x = mock();
      expect(Symbol.asyncIterator in x).toBeTruthy();
      expect(x[Symbol.asyncIterator]).toBeInstanceOf(Function);
      expect(typeof x[Symbol.asyncIterator]).toBe("function");
      expect(() => x[Symbol.asyncIterator]()).not.toThrow();
    })
    describe("Symbol.asyncIterator()", () => {
      isAsyncIterator(() => mock()[Symbol.asyncIterator](), _values)
    })
  })
}

export function isNotAsyncIterable(mock: () => any, values: Iterable<any>) {
  const _values = Array.from(values)
  it("is not AsyncIterable", async () => {
    const x = mock();
    expect(Symbol.asyncIterator in x).toBeFalsy();
    expect(x[Symbol.asyncIterator]).toBeUndefined();
  });
}

export function isIterator(mock: () => any, values: Iterable<any>) {
  const _values = Array.from(values)
  describe("Iterator", () => {
    it("is an Iterator", async () => {
      const x = mock();
      const next = x.next();
      expect(next).toHaveProperty("done");
      expect(next.done).toBe(false);
      expect(next).toHaveProperty("value");
      expect(next.value).toStrictEqual(_values[0]);
    });
    it("returns the correct results on iteration", async () => {
      const x = mock();
      for (const val of _values) {
        const next = x.next()
        expect(next).toHaveProperty("done");
        expect(next.done).toBeFalsy();
        expect(next).toHaveProperty("value");
        expect(next.value).toStrictEqual(val);
      }
      expect(x.next()).toMatchObject({ done: true });
      expect(x.next()).toMatchObject({ done: true });
    });
  })
}

export function isNotIterator(mock: () => any, values: Iterable<any>) {
  const _values = Array.from(values)
  it("is not an Iterator", async () => {
    const x = mock();
    if (typeof x.next !== "function") {
      expect(typeof x.next).not.toBe("function")
    } else {
      const next = x.next();
      expect(next).not.toHaveProperty("done");
      expect(next).not.toHaveProperty("value");
    }
  });
}

export function isAsyncIterator(mock: () => any, values: Iterable<any>) {
  const _values = Array.from(values)
  describe("AsyncIterator", () => {
    it("is an AsyncIterator", async () => {
      const x = mock();
      const next = x.next();
      // expect(next).toBeInstanceOf(Promise);
      expect(next).toHaveProperty("then");
      expect(next).toHaveProperty("catch");
      expect(next).toHaveProperty("finally");
      expect(() => next.then(() => {})).not.toThrow();
      expect(await next).toHaveProperty("done");
      expect((await next).done).toBeFalsy();
      expect(await next).toHaveProperty("value");
      expect((await next).value).toStrictEqual(_values[0]);
    });
    it("returns the correct results on iteration", async () => {
      const x = mock();
      for (const val of _values) {
        const next = await x.next()
        expect(await next).toHaveProperty("done");
        expect((await next).done).toBeFalsy();
        expect(await next).toHaveProperty("value");
        expect((await next).value).toStrictEqual(val);
      }
      await expect(x.next()).resolves.toMatchObject({ done: true });
      await expect(x.next()).resolves.toMatchObject({ done: true });
    });
  })
}

export function isNotAsyncIterator(mock: () => any, values: Iterable<any>) {
  const _values = Array.from(values)
  it("is not an AsyncIterator", async () => {
    const x = mock();
    if (typeof x.next !== "function") {
      expect(typeof x.next).not.toBe("function")
    } else {
      const next = x.next();
      expect(next).not.toBeInstanceOf(Promise);
      expect(next).not.toHaveProperty("then");
      expect(next).not.toHaveProperty("catch");
      expect(next).not.toHaveProperty("finally");
      expect(() => next.then(() => {})).toThrowError(".then is not a function");
    }
  });
}
