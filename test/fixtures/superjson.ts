/*
 * Values and a data generator ported from superjson's tests:
 * https://github.com/ravionhq/superjson/blob/aaa65e3/src/index.test.ts
 *
 * superjson is MIT licensed, Copyright (c) 2020 Simon Knott and superjson contributors.
 * `superjsonCorpus` keeps the inputs of the "stringify & parse" cases and the class-instance
 * tests, under their upstream names. It leaves out the cases that need mongodb or decimal.js.
 * Upstream registers symbols and classes with SuperJSON, and this port has no use for that, so
 * it creates them once instead, which lets two calls build equal values.
 */
import type { CorpusEntry } from "./corpus";

const entries: CorpusEntry[] = [];

function testCase(name: string, make: () => unknown, extra: Omit<CorpusEntry, "name" | "make"> = {}): void {
  entries.push({ name: `superjson: ${name}`, make, ...extra });
}

const asPlainObjects = { distinct: "the clone holds plain objects, and fast-equals requires matching constructors" };

testCase("works for objects", () => ({ a: { 1: 5, 2: { 3: "c" } }, b: null }));
testCase("special case: objects with array-like keys", () => ({ a: { 0: 3, 1: 5, 2: { 3: "c" } }, b: null }));
testCase("works for arrays", () => ({ a: [1, undefined, 2] }));
testCase("works for Sets", () => ({ a: new Set([1, undefined, 2]) }));
testCase("works for top-level Sets", () => new Set([1, undefined, 2]));
testCase("works for Maps", () => ({
  a: new Map([
    [1, "a"],
    [NaN, "b"],
  ]),
  b: new Map([["2", "b"]]),
  d: new Map([[true, "true key"]]),
}));
testCase("preserves object identity", () => {
  const a = { id: "a" };
  const b = { id: "b" };
  return { options: [a, b], selected: a };
});
testCase("works for paths containing dots", () => ({ "a.1": { b: new Set([1, 2]) } }));
testCase("works for paths containing backslashes", () => ({ "a\\.1": { b: new Set([1, 2]) } }));
testCase("works for dates", () => ({ meeting: { date: new Date(2020, 1, 1) } }));
testCase("works for Errors", () => ({ e: new Error("epic fail") }));
testCase("works for Error causes", () => ({
  e: new Error("subtle fail", { cause: new Error("catastrophic failure") }),
}));
testCase("works for regex", () => ({ a: /hello/g }));
testCase("works for Infinity", () => ({ a: Number.POSITIVE_INFINITY }));
testCase("works for -Infinity", () => ({ a: Number.NEGATIVE_INFINITY }));
testCase("works for NaN", () => ({ a: NaN }));
testCase("works for bigint", () => ({ a: BigInt("1021312312412312312313") }));
testCase("works for unknown", () => ({ name: "@ftonato", age: 1 }));
testCase(
  "works for self-referencing objects",
  () => {
    const a = { role: "parent", children: [] as unknown[] };
    const b = { role: "child", parents: [a] };
    a.children.push(b);
    return a;
  },
  { circular: true },
);
testCase("works for Maps with two keys that serialize to the same string but have a different reference", () =>
  new Map([
    [/a/g, "foo"],
    [/a/g, "bar"],
  ]),
);
testCase("works for referentially equal maps", () => {
  const map = new Map([[1, 1]]);
  return { a: map, b: map };
});
testCase("works for maps with non-uniform keys", () => ({
  map: new Map<string | number, number>([
    [1, 1],
    ["1", 1],
  ]),
}));
testCase("works for referentially equal values inside a set", () => {
  const user = { id: 2 };
  return { users: new Set([user]), userOfTheMonth: user };
});
testCase("works for referentially equal values in different maps and sets", () => {
  const user = { id: 2 };
  return {
    workspaces: new Map([
      [1, { users: new Set([user]) }],
      [2, { users: new Set([user]) }],
    ]),
  };
});

const parent = Symbol("Parent");
const child = Symbol("Child");
const cool = Symbol("cool");
const symbolClone = { throws: "symbols cannot be cloned" };
testCase("works for symbols", () => ({ a: { role: parent }, b: { role: child } }), { clone: symbolClone });
testCase(
  "issue #58",
  () => ({
    q: [
      9,
      {
        henlo: undefined,
        yee: new Date(2020, 1, 1),
        yee2: new Date(2020, 1, 1),
        foo1: new Date(2020, 1, 1),
        z: cool,
      },
    ],
  }),
  { clone: symbolClone },
);

class User {
  constructor(
    public username: string,
    public password: string,
  ) {}
}
testCase("works with custom allowedProps", () => new User("bongocat", "supersecurepassword"), { clone: asPlainObjects });
testCase("works with typed arrays", () => ({ a: new Int8Array([1, 2]), b: new Uint8ClampedArray(3) }));
testCase("works with NaN and Infinity in Float64Array, issue #292", () => ({
  a: new Float64Array([NaN, 0, NaN, 1]),
  b: new Float64Array([Infinity, -Infinity, NaN, 0]),
  c: new Float32Array([NaN, Infinity, -Infinity]),
}));
testCase("works with BigInt typed arrays", () => ({
  a: new BigInt64Array([1n, 2n, -3n, 9007199254740993n]),
  b: new BigUint64Array([0n, 18446744073709551615n]),
}));
testCase("works for undefined, issue #48", () => undefined);

class Pet {
  constructor(private name: string) {}
  woof(): string {
    return this.name;
  }
}
class PetOwner {
  constructor(public pet: Pet) {}
}
testCase("regression #109: nested classes", () => new PetOwner(new Pet("Rover")), { clone: asPlainObjects });
testCase(
  "works with URL",
  () => ({ a: new URL("https://example.com/"), b: new URL("https://github.com/blitz-js/superjson") }),
  { clone: { throws: "Node.js cannot clone a URL" } },
);
testCase("repro #310: meta path escape bug", () => ({
  a: ["/'a'[0]: string that becomes a regex/"],
  "a.0": /'a.0': regex that becomes a string/,
  "b.0": "/'b.0': string that becomes a regex/",
  "b\\": [/'b\\'[0]: regex that becomes a string/],
}));

class Carriage {
  constructor(public name: string) {}
}
class Train {
  constructor(
    private topSpeed: number,
    private color: "red" | "blue" | "yellow",
    private brand: string,
    public carriages: Set<Carriage>,
  ) {}
  brag(): string {
    return `I'm a ${this.brand} in freakin' ${this.color} and I go ${this.topSpeed} km/h, isn't that bonkers?`;
  }
}
testCase(
  "when serializing custom class instances: revives them to their original class",
  () => ({ s7: new Train(100, "yellow", "Bombardier", new Set([new Carriage("front"), new Carriage("back")])) }),
  { clone: asPlainObjects },
);
class Currency {
  constructor(private valueInUsd: number) {}
  get inUSD(): number {
    return this.valueInUsd;
  }
}
testCase("with accessor attributes: works", () => ({ price: new Currency(100) }), { clone: asPlainObjects });
testCase("regression #83: negative zero", () => -0);

export const superjsonCorpus = entries;

/**
 * Upstream's "performance regression" data: records holding 82 Dates each, in two nested arrays
 * of 10. Upstream stamps every Date with `new Date()`; this port derives each Date from the
 * record's index and its position, so the `count` records are distinct and reproducible.
 */
export function superjsonDateRecords(count: number): Record<string, unknown>[] {
  const base = Date.UTC(2020, 0, 1);
  const data: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    let n = 0;
    const date = () => new Date(base + i * 1_000_000 + n++ * 1_000);
    const nested = () =>
      Array.from({ length: 10 }, () => ({
        createdAt: date(),
        updatedAt: date(),
        innerNested: { createdAt: date(), updatedAt: date() },
      }));
    data.push({ createdAt: date(), updatedAt: date(), nested1: nested(), nested2: nested() });
  }
  return data;
}
