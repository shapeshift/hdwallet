import { rest } from "msw";
import { setupServer } from "msw/node";

export = function newMswMock(handlers: Record<string, Record<string, unknown>> = {}) {
  Object.values(handlers).forEach((x) => {
    Object.entries(x).forEach(([k, v]) => {
      x[k] = Object.assign(
        jest.fn((...args: any[]) => (typeof v === "function" ? v(...args) : v)),
        v
      );
    });
  });

  const processedHandlers = handlers as Record<string, Record<string, jest.Mock>>;

  const self = jest.fn();
  return Object.assign(self, {
    handlers: processedHandlers,
    setupServer() {
      return setupServer(
        ...Object.entries(this.handlers)
          .map(([method, mocks]) =>
            Object.entries(mocks).map(([k, v]) => {
              return (rest as any)[method](k, (req: any, res: any, ctx: any) => {
                const body = typeof req.body === "string" && req.body !== "" ? JSON.parse(req.body) : req.body;
                if (body !== undefined && body !== "") {
                  self(method.toUpperCase(), k, body);
                } else {
                  self(method.toUpperCase(), k);
                }
                let status = 200;
                let out;
                try {
                  out = v(body);
                } catch (e) {
                  if (typeof e !== "number") throw e;
                  status = e;
                  out = {};
                }
                return res(ctx.status(status), ctx.json(out));
              });
            })
          )
          .reduce((a, x) => a.concat(x), [])
      );
    },
    startServer() {
      this.setupServer().listen({
        onUnhandledRequest(req) {
          self(req.method, req.url.href);
          console.error("Unhandled request:", req.method, req.url.href);
          throw new Error(`Unhandled ${req.method} request to ${req.url.href}`);
        },
      });
      return this;
    },
    clear() {
      self.mockClear();
      Object.values(this.handlers).forEach((x) => Object.values(x).forEach((y) => y.mockClear()));
    },
  });
};
