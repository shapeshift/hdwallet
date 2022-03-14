function mockTraps(mock: () => unknown) {
  return new Proxy(
    {},
    {
      get(_, propName) {
        return (...args: any[]) => (mock(), (Reflect as any)[propName](...args));
      },
    }
  );
}

function doMock<T extends object>(target: T) {
  const mock = jest.fn();
  return [
    typeof target === "object" || typeof target === "function" ? new Proxy(target, mockTraps(mock)) : target,
    mock,
  ] as const;
}

export function bind(obj: Record<string, () => unknown>, prop: string, ...args: any[]) {
  const mock = jest.fn();
  const [objProxy, objMock] = doMock(obj);
  objMock.mockImplementation(() => mock());
  const argProxies = args.map((arg) => {
    const [argProxy, argMock] = doMock(arg);
    argMock.mockImplementation(() => mock());
    return argProxy;
  });
  return [Function.prototype.bind.call(obj[prop], objProxy, ...argProxies), mock];
}

export function call(obj: Record<string, () => unknown>, prop: string, ...args: any[]) {
  expect(obj[prop]).toBeInstanceOf(Function);
  const [fn, mock] = bind(obj, prop, ...args);
  const out = fn();
  if ((typeof out === "object" || typeof out === "function") && "then" in out && out.then instanceof Function) {
    return (async () => {
      await out; // make sure the method under test has time to hit the tripwire
      expect(mock).not.toHaveBeenCalled();
      return out;
    })();
  }
  expect(mock).not.toHaveBeenCalled();
  return out;
}

export const mock = doMock;
