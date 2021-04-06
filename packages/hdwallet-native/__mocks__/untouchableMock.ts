function mockTraps(mock: Function) {
  return new Proxy(
    {},
    {
      get(_, propName) {
        return (...args: any[]) => (mock(), Reflect[propName](...args));
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
export const mock = doMock;

export function bind(obj, prop, ...args) {
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

export function call(obj, prop, ...args) {
  expect(obj[prop]).toBeInstanceOf(Function);
  const [fn, mock] = bind(obj, prop, ...args);
  const out = fn();
  if ((typeof out === "object" || typeof out === "function") && "then" in out && out.then instanceof Function) {
    return (async () => {
      const outResolved = await out;
      expect(mock).not.toHaveBeenCalled();
      return out;
    })();
  }
  expect(mock).not.toHaveBeenCalled();
  return out;
}
