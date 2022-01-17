import { overlay } from "./overlay"

function getAllProps(x: object | null) {
  const out = new Set();
  for (
    let obj = x ?? null;
    ![null, Object.prototype, Function.prototype].includes(obj);
    obj = Reflect.getPrototypeOf(obj!)
  ) {
    Reflect.ownKeys(obj!).forEach((y) => out.add(y));
  }
  return [...out];
}
function getEnumerableProps(x: object | null) {
  const out = new Set();
  for (
    let obj = x ?? null;
    ![null, Object.prototype, Function.prototype].includes(obj);
    obj = Reflect.getPrototypeOf(obj!)
  ) {
    Reflect.ownKeys(obj!)
      .filter((y) => Object.prototype.propertyIsEnumerable.call(obj, y))
      .forEach((y) => out.add(y));
  }
  return [...out];
}

describe("overlay", () => {
  it("works", async () => {
    const obj = overlay({ foo: "bar", bar: "baz" }, { baz: "bash" });
    expect(obj.foo).toEqual("bar");
    expect(obj.bar).toEqual("baz");
    expect(obj.baz).toEqual("bash");
    expect(new Set(getAllProps(obj))).toEqual(new Set(["foo", "bar", "baz"]));
    expect(new Set(getEnumerableProps(obj))).toEqual(new Set(["foo", "bar", "baz"]));
    expect(Reflect.getOwnPropertyDescriptor(obj, "foo")).toMatchInlineSnapshot(`
      Object {
        "configurable": true,
        "enumerable": true,
        "value": "bar",
        "writable": true,
      }
    `);
    expect(Reflect.getOwnPropertyDescriptor(obj, "baz")).toMatchInlineSnapshot(`
      Object {
        "configurable": true,
        "enumerable": true,
        "value": "bash",
        "writable": true,
      }
    `);
  });

  it("works with an upper prototype", async () => {
    const obj = overlay({ foo: "bar" }, Object.assign(Object.create({ baz: "bash" }), {
      bar: "baz",
    }));
    expect(obj.foo).toEqual("bar");
    expect(obj.bar).toEqual("baz");
    expect(obj.baz).toEqual("bash");
    expect(new Set(getAllProps(obj))).toEqual(new Set(["foo", "bar", "baz"]));
    expect(new Set(getEnumerableProps(obj))).toEqual(new Set(["foo", "bar", "baz"]));
    expect(new Set(getAllProps(Object.getPrototypeOf(obj)))).toEqual(new Set(["baz"]));
    expect(new Set(getEnumerableProps(Object.getPrototypeOf(obj)))).toEqual(new Set(["baz"]));
    expect(Reflect.getOwnPropertyDescriptor(obj, "foo")).toMatchInlineSnapshot(`
      Object {
        "configurable": true,
        "enumerable": true,
        "value": "bar",
        "writable": true,
      }
    `);
    expect(Reflect.getOwnPropertyDescriptor(obj, "bar")).toMatchInlineSnapshot(`
      Object {
        "configurable": true,
        "enumerable": true,
        "value": "baz",
        "writable": true,
      }
    `);
    expect(Reflect.getOwnPropertyDescriptor(obj, "baz")).toBeUndefined();
    expect(Reflect.getOwnPropertyDescriptor(Object.getPrototypeOf(obj), "baz")).toMatchInlineSnapshot(`
      Object {
        "configurable": true,
        "enumerable": true,
        "value": "bash",
        "writable": true,
      }
    `);
  });

  it("works with an lower prototype", async () => {
    const obj = overlay(Object.assign(Object.create({ foo: "bar" }), {
      bar: "baz",
    }), { baz: "bash" });
    expect(obj.foo).toEqual("bar");
    expect(obj.bar).toEqual("baz");
    expect(obj.baz).toEqual("bash");
    expect(new Set(getAllProps(obj))).toEqual(new Set(["foo", "bar", "baz"]));
    expect(new Set(getEnumerableProps(obj))).toEqual(new Set(["foo", "bar", "baz"]));
    expect(new Set(getAllProps(Object.getPrototypeOf(obj)))).toEqual(new Set(["foo"]));
    expect(new Set(getEnumerableProps(Object.getPrototypeOf(obj)))).toEqual(new Set(["foo"]));
    expect(Reflect.getOwnPropertyDescriptor(obj, "foo")).toBeUndefined();
    expect(Reflect.getOwnPropertyDescriptor(Object.getPrototypeOf(obj), "foo")).toMatchInlineSnapshot(`
      Object {
        "configurable": true,
        "enumerable": true,
        "value": "bar",
        "writable": true,
      }
    `);
    expect(Reflect.getOwnPropertyDescriptor(obj, "bar")).toMatchInlineSnapshot(`
      Object {
        "configurable": true,
        "enumerable": true,
        "value": "baz",
        "writable": true,
      }
    `);
    expect(Reflect.getOwnPropertyDescriptor(obj, "baz")).toMatchInlineSnapshot(`
      Object {
        "configurable": true,
        "enumerable": true,
        "value": "bash",
        "writable": true,
      }
    `);
  });

  it("works with an upper and lower prototypes", async () => {
    const obj = overlay(Object.assign(Object.create({ foo: "bar" }), {
      bar: "baz",
    }), Object.assign(Object.create({ baz: "bash" }), {
      bash: "quux",
    }));
    expect(obj.foo).toEqual("bar");
    expect(obj.bar).toEqual("baz");
    expect(obj.baz).toEqual("bash");
    expect(obj.bash).toEqual("quux");
    expect(new Set(getAllProps(obj))).toEqual(new Set(["foo", "bar", "baz", "bash"]));
    expect(new Set(getEnumerableProps(obj))).toEqual(new Set(["foo", "bar", "baz", "bash"]));
    expect(new Set(getAllProps(Object.getPrototypeOf(obj)))).toEqual(new Set(["foo", "baz"]));
    expect(new Set(getEnumerableProps(Object.getPrototypeOf(obj)))).toEqual(new Set(["foo", "baz"]));
    expect(Reflect.getOwnPropertyDescriptor(obj, "foo")).toBeUndefined();
    expect(Reflect.getOwnPropertyDescriptor(Object.getPrototypeOf(obj), "foo")).toMatchInlineSnapshot(`
      Object {
        "configurable": true,
        "enumerable": true,
        "value": "bar",
        "writable": true,
      }
    `);
    expect(Reflect.getOwnPropertyDescriptor(obj, "bar")).toMatchInlineSnapshot(`
      Object {
        "configurable": true,
        "enumerable": true,
        "value": "baz",
        "writable": true,
      }
    `);
    expect(Reflect.getOwnPropertyDescriptor(obj, "baz")).toBeUndefined();
    expect(Reflect.getOwnPropertyDescriptor(Object.getPrototypeOf(obj), "baz")).toMatchInlineSnapshot(`
      Object {
        "configurable": true,
        "enumerable": true,
        "value": "bash",
        "writable": true,
      }
    `);
    expect(Reflect.getOwnPropertyDescriptor(obj, "bash")).toMatchInlineSnapshot(`
    Object {
      "configurable": true,
      "enumerable": true,
      "value": "quux",
      "writable": true,
    }
  `);
  });
});
