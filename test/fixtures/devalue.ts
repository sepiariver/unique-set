/*
 * Values ported from devalue's round-trip fixtures (the `fixtures` object):
 * https://github.com/sveltejs/devalue/blob/12ad9d6/test/index.test.js
 *
 * devalue is MIT licensed, Copyright (c) 2018-19 its contributors
 * <https://github.com/rich-harris/devalue/graphs/contributors>.
 * Fixture values are kept as upstream has them, and so are their names, except that the second
 * "Object (cyclical)" and "Dangerous regex" are suffixed to keep names unique. The Temporal
 * fixtures are left out, because Node.js has no native Temporal and upstream loads a polyfill.
 */
import vm from "node:vm";
import type { CorpusEntry } from "./corpus";

const entries: CorpusEntry[] = [];

function fixture(category: string, name: string, make: () => unknown, extra: Omit<CorpusEntry, "name" | "make"> = {}): void {
  entries.push({ name: `devalue ${category}: ${name}`, make, ...extra });
}

const byReference = { distinct: "compared by reference: no enumerable state for fast-equals to compare" };

for (const [name, value] of [
  ["number: positive integer", 42],
  ["number: negative integer", -5],
  ["number: positive decimal", 0.1],
  ["number: negative decimal", -0.1],
  ["number: NaN", NaN],
  ["number: +Infinity", Infinity],
  ["number: -Infinity", -Infinity],
  ["number: zero", 0],
  ["number: negative zero", -0],
  ["string", "woo!!!"],
  ["boolean", true],
  ["bigint", 1n],
  ["undefined", undefined],
  ["null", null],
] as const) {
  fixture("primitives", name, () => value);
}

for (const [name, make] of [
  ["Number: positive integer", () => new Number(42)],
  ["Number: negative integer", () => new Number(-2)],
  ["Number: positive decimal", () => new Number(0.1)],
  ["Number: negative decimal", () => new Number(-0.1)],
  ["Number: NaN", () => new Number(NaN)],
  ["Number: +Infinity", () => new Number(Infinity)],
  ["Number: -Infinity", () => new Number(-Infinity)],
  ["Number: zero", () => new Number(0)],
  ["Number: negative zero", () => new Number(-0)],
  ["String", () => new String("woo!!!")],
  ["Boolean", () => new Boolean(true)],
  ["BigInt", () => Object(1n)],
] as const) {
  fixture("boxed_primitives", name, make);
}

const veryLength = 1_000_001;
fixture("basics", "RegExp", () => /regexp/gim);
fixture("basics", "Date", () => new Date(1e12));
fixture("basics", "invalid Date", () => new Date(""));
fixture("basics", "Array", () => ["a", "b", "c"]);
fixture("basics", "Array where negative zero appears after normal zero", () => [0, -0]);
fixture("basics", "Array (empty)", () => []);
// eslint-disable-next-line no-sparse-arrays
fixture("basics", "Array (sparse)", () => [, "b", ,]);
fixture("basics", "Array (very sparse)", () => {
  const arr: string[] = [];
  arr[veryLength - 1] = "x";
  return arr;
});
fixture("basics", "Array (very sparse, multiple values)", () => {
  const arr: string[] = [];
  arr[10] = "a";
  arr[20] = "b";
  return arr;
});
fixture("basics", "Object", () => ({ foo: "bar", "x-y": "z" }));
fixture("basics", "Set", () => new Set([1, 2, 3]));
fixture("basics", "Map", () => new Map([["a", "b"]]));
fixture("basics", "Uint8Array", () => new Uint8Array([1, 2, 3]));
fixture("basics", "Node Buffer", () => Buffer.alloc(4, 65), {
  clone: { distinct: "the clone is a Uint8Array, and fast-equals requires matching constructors" },
});
fixture("basics", "Float64Array with negative zero", () => new Float64Array([-0, 1.5]));
fixture("basics", "BigInt64Array", () => new BigInt64Array([1n, -2n, 3n]));
fixture("basics", "BigUint64Array", () => new BigUint64Array([1n, 2n, 3n]));
fixture("basics", "ArrayBuffer", () => new Uint8Array([1, 2, 3]).buffer);
fixture("basics", "DataView", () => new DataView(new Uint8Array([1, 2, 3]).buffer));
fixture("basics", "DataView subview", () => new DataView(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).buffer, 2, 4));
fixture("basics", "URL", () => new URL("https://user:password@example.com/<script>/path?foo=bar#hash"), {
  clone: { throws: "Node.js cannot clone a URL" },
});
fixture("basics", "URLSearchParams", () => new URLSearchParams("foo=1&foo=2&baz=<+>"), {
  copies: byReference,
  clone: { throws: "Node.js cannot clone a URLSearchParams" },
});
fixture("basics", "Sliced typed array", () => new Uint16Array([10, 20, 30, 40]).subarray(1, 3));

for (const [name, value] of [
  ["newline", "a\nb"],
  ["double quotes", '"yar"'],
  ["lone low surrogate", "a\uDC00b"],
  ["lone high surrogate", "a\uD800b"],
  ["two low surrogates", "a\uDC00\uDC00b"],
  ["two high surrogates", "a\uD800\uD800b"],
  ["surrogate pair", "𝌆"],
  ["surrogate pair in wrong order", "a\uDC00\uD800b"],
  ["nul", "\0"],
  ["control character", "\u0001"],
  ["control character extremum", "\u001F"],
  ["backslash", "\\"],
] as const) {
  fixture("strings", name, () => value);
}

function NullObject(): void {}
NullObject.prototype = Object.create(null);

const cyclic = { circular: true } as const;
const nullPrototype = {
  circular: true,
  clone: { distinct: "the clone has Object.prototype, and fast-equals requires matching constructors" },
} as const;
fixture("cycles", "Map (cyclical)", () => {
  const map = new Map<string, unknown>();
  map.set("self", map);
  return map;
}, cyclic);
fixture("cycles", "Set (cyclical)", () => {
  const set = new Set<unknown>();
  set.add(set);
  set.add(42);
  return set;
}, cyclic);
fixture("cycles", "Array (cyclical)", () => {
  const arr: unknown[] = [];
  arr[0] = arr;
  return arr;
}, cyclic);
fixture("cycles", "Object (cyclical)", () => {
  const obj: Record<string, unknown> = {};
  obj["self"] = obj;
  return obj;
}, cyclic);
fixture("cycles", "Object with null prototype (cyclical)", () => {
  const obj: Record<string, unknown> = Object.create(null);
  obj["self"] = obj;
  return obj;
}, nullPrototype);
fixture("cycles", "Object with null prototype class", () => {
  const obj = Object.assign(new (NullObject as unknown as new () => object)(), { foo: "bar" }) as Record<string, unknown>;
  obj["self"] = obj;
  return obj;
}, nullPrototype);
fixture("cycles", "Object (cyclical), two objects", () => {
  const first: Record<string, unknown> = {};
  const second: Record<string, unknown> = {};
  first["second"] = second;
  second["first"] = first;
  return [first, second];
}, cyclic);

const twice = <T>(value: T): [T, T] => [value, value];
fixture("repetition", "string (repetition)", () => ["a string", "a string"]);
fixture("repetition", "null (repetition)", () => [null, null]);
fixture("repetition", "number: NaN (repetition)", () => [NaN, NaN]);
fixture("repetition", "Number (repetition)", () => twice(Object(42)));
fixture("repetition", "BigInt (repetition)", () => twice(Object(1n)));
fixture("repetition", "Number: NaN (repetition)", () => twice(Object(NaN)));
fixture("repetition", "Object (repetition)", () => twice({}));
fixture("repetition", "empty Map (repetition)", () => twice(new Map()));
fixture("repetition", "empty Set (repetition)", () => twice(new Set()));
fixture("repetition", "RegExp (repetition)", () => twice(/regexp/));
fixture("repetition", "Date (repetition)", () => twice(new Date(1e12)));
fixture("repetition", "Array buffer (repetition)", () => {
  const uint8 = new Uint8Array(10);
  const uint16 = new Uint16Array(uint8.buffer);
  for (let i = 0; i < uint8.length; i += 1) uint8[i] = i;
  return [uint8, uint16];
});
fixture("repetition", "TypedArray (repetition)", () => twice(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])));
fixture("repetition", "Array Buffer and TypedArray (repetition)", () => {
  const uint8 = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  return [uint8, uint8, new Uint16Array(uint8.buffer)];
});
fixture("repetition", "DataView (repetition)", () => twice(new DataView(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).buffer)));
fixture("repetition", "Array Buffer and DataView (repetition)", () => {
  const dv = new DataView(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).buffer);
  return [dv, dv, dv.buffer];
});
fixture("repetition", "DataView subview (repetition)", () =>
  twice(new DataView(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).buffer, 2, 4)),
);
fixture("repetition", "BigInt64Array (repetition)", () => twice(new BigInt64Array([1n, 2n, 3n])));
fixture("repetition", "Map key (repetition)", () => {
  const shared = { id: 1 };
  return [shared, new Map([[shared, "v"]])];
});
fixture("repetition", "Map keys (interlinked)", () => {
  const node1 = { id: 1 };
  const node2 = { id: 2 };
  const node3 = { id: 3 };
  return new Map([
    [node1, new Map([[node2, 1], [node3, 1]])],
    [node2, new Map([[node1, 1], [node3, 1]])],
    [node3, new Map([[node1, 1], [node2, 1]])],
  ]);
});

fixture("XSS", "Dangerous string", () => `</script><script src='https://evil.com/script.js'>alert('pwned')</script><script>`);
fixture("XSS", "Dangerous key", () => ({ '<svg onload=alert("xss_works")>': "bar" }));
fixture("XSS", "Dangerous regex", () => /[</script><script>alert('xss')//]/);
fixture("XSS", "Dangerous regex (repetition)", () => twice(/[</script><script>alert('xss')//]/));

// One context for every call, so that two cross-realm objects share a constructor.
const realm = vm.createContext({});
fixture("misc", "Object without prototype", () => Object.create(null), {
  clone: { distinct: "the clone has Object.prototype, and fast-equals requires matching constructors" },
});
fixture("misc", "cross-realm POJO", () => vm.runInContext("({})", realm), {
  clone: { distinct: "the clone is a same-realm object, and fast-equals requires matching constructors" },
});
fixture("misc", "non-enumerable symbolic key", () => {
  const obj = { x: 1 };
  Object.defineProperty(obj, Symbol("key"), { value: "value", enumerable: false });
  return obj;
});

class Foo {
  constructor(public value: unknown) {}
}
class Bar {
  constructor(public value: unknown) {}
}
const asPlainObjects = { distinct: "the clone holds plain objects, and fast-equals requires matching constructors" };
fixture("custom", "Custom type", () => twice(new Foo({ bar: new Bar({ answer: 42 }) })), { clone: asPlainObjects });
fixture("custom_fallback", "Custom fallback", () => new Date("invalid"));

class FunctionRef {
  constructor(public fn: (x: number) => number) {}
}
const testFn = (x: number): number => x * 2;
const functionClone = { throws: "functions cannot be cloned" };
fixture("functions", "Function wrapped in custom type", () => new FunctionRef(testFn), { clone: functionClone });
fixture("functions", "Function in nested structure", () => ({ fn: testFn, nested: { data: 42 } }), { clone: functionClone });

export const devalueCorpus = entries;
