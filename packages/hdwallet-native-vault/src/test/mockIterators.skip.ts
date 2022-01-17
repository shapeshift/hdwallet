export const list = ["apple", "banana", "pear"];

export function mockIterator() {
  const iterableIterator = list.values();
  return {
    next: () => iterableIterator.next(),
  };
}

export function mockIterable() {
  const iterator = mockIterator()
  return {
    [Symbol.iterator]: () => iterator
  }
}

export function mockAsyncIterator() {
  const iterableIterator = list.values();
  return {
    next: async () => iterableIterator.next(),
  };
}

export function mockAsyncIterable() {
  const asyncIterator = mockAsyncIterator()
  return {
    [Symbol.asyncIterator]: () => asyncIterator
  }
}

export function mockHybridIterator() {
  const iterableIterator = list.values();
  return {
    next: () => {
      const out = iterableIterator.next()
      return Object.assign(Promise.resolve(out), {
        done: out.done,
        value: out.value
      })
    }
  }
}

export function mockHybridIterable() {
  const iterator = mockHybridIterator()
  return {
    next() {
      return iterator.next()
    },
    [Symbol.asyncIterator]: () => iterator,
    [Symbol.iterator]: () => iterator
  }
}
