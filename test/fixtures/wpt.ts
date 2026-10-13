/*
 * Values ported from the web-platform-tests structured clone battery:
 * https://github.com/web-platform-tests/wpt/blob/b244ad8/html/webappapis/structured-clone/structured-clone-battery-of-tests.js
 *
 * Upstream clones each input and checks that the copy matches it. This port keeps the inputs and
 * leaves out the cases that need a DOM (FileList, ImageData, ImageBitmap), the Array and Object
 * wrappers around each Blob, and the cases that only test that cloning fails. Each `make` is the
 * upstream input, or the upstream input function.
 *
 * The 3-Clause BSD License
 *
 * Copyright © web-platform-tests contributors
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted
 * provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this list of
 *    conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice, this list of
 *    conditions and the following disclaimer in the documentation and/or other materials provided
 *    with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors may be used to
 *    endorse or promote products derived from this software without specific prior written
 *    permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
 * FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 * OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */
import type { CorpusEntry } from "./corpus";

const entries: CorpusEntry[] = [];

function check(name: string, make: () => unknown, extra: Omit<CorpusEntry, "name" | "make"> = {}): void {
  entries.push({ name: `wpt: ${name}`, make, ...extra });
}

/** Upstream's pattern: each value alone, then all of them in an Array and in an Object. */
function family(kind: string, values: Record<string, () => unknown>): void {
  for (const [label, make] of Object.entries(values)) check(`${kind} ${label}`, make);
  check(`Array ${kind} objects`, () => Object.values(values).map((make) => make()));
  check(`Object ${kind} objects`, () =>
    Object.fromEntries(Object.entries(values).map(([label, make]) => [label, make()])),
  );
}

const primitives: Record<string, unknown> = {
  undefined: undefined,
  null: null,
  true: true,
  false: false,
  "empty string": "",
  "lone high surrogate": "\uD800",
  "lone low surrogate": "\uDC00",
  NUL: "\u0000",
  "astral character": "􏿽",
  "0.2": 0.2,
  "0": 0,
  "-0": -0,
  NaN: NaN,
  Infinity: Infinity,
  "-Infinity": -Infinity,
  "9007199254740992": 9007199254740992,
  "-9007199254740992": -9007199254740992,
  "9007199254740994": 9007199254740994,
  "-9007199254740994": -9007199254740994,
};
for (const [label, value] of Object.entries(primitives)) check(`primitive ${label}`, () => value);
const bigints: Record<string, bigint> = {
  "0n": 0n,
  "-0n": -0n,
  "-9007199254740994000n": -9007199254740994000n,
  "-9007199254740994000900719925474099400090071992547409940009007199254740994000n":
    -9007199254740994000900719925474099400090071992547409940009007199254740994000n,
};
for (const [label, value] of Object.entries(bigints)) check(`primitive BigInt ${label}`, () => value);
check("Array primitives", () => [...Object.values(primitives), -12n, -0n, 0n]);
check("Object primitives", () => ({ ...primitives }));

family("Boolean", { true: () => new Boolean(true), false: () => new Boolean(false) });
family("String", {
  "empty string": () => new String(""),
  "lone high surrogate": () => new String("\uD800"),
  "lone low surrogate": () => new String("\uDC00"),
  NUL: () => new String("\u0000"),
  "astral character": () => new String("􏿽"),
});
family("Number", {
  "0.2": () => new Number(0.2),
  "0": () => new Number(0),
  "-0": () => new Number(-0),
  NaN: () => new Number(NaN),
  Infinity: () => new Number(Infinity),
  "-Infinity": () => new Number(-Infinity),
  "9007199254740992": () => new Number(9007199254740992),
  "-9007199254740992": () => new Number(-9007199254740992),
  "9007199254740994": () => new Number(9007199254740994),
  "-9007199254740994": () => new Number(-9007199254740994),
});
check("BigInt -9007199254740994n", () => Object(-9007199254740994n));
family("Date", {
  "0": () => new Date(0),
  "-0": () => new Date(-0),
  "-8.64e15": () => new Date(-8.64e15),
  "8.64e15": () => new Date(8.64e15),
});

function regExpFlagsLastIndex(): RegExp {
  const r = /foo/gim;
  r.lastIndex = 2;
  return r;
}
family("RegExp", {
  "flags and lastIndex": regExpFlagsLastIndex,
  "sticky flag": () => new RegExp("foo", "y"),
  "unicode flag": () => new RegExp("foo", "u"),
  empty: () => new RegExp(""),
  slash: () => new RegExp("/"),
  "new line": () => new RegExp("\n"),
});

check("Empty Error object", () => new Error());
for (const constructor of [Error, EvalError, RangeError, ReferenceError, SyntaxError, TypeError, URIError]) {
  check(
    `${constructor.name} object`,
    () => Object.assign(new constructor("Error message here", { cause: "my cause" }), { foo: "testing" }),
    { clone: { distinct: "the clone drops the enumerable own property foo" } },
  );
}

const byReference = { distinct: "compared by reference: no enumerable state for fast-equals to compare" };
const blobBytes = (bytes: number[]) => () => new Blob([new Uint8Array(bytes)]);
const encodeCesu8 = (codeUnits: number[]): number[] =>
  codeUnits.flatMap((u) => [0xe0 + ((u & 0xf000) >> 12), 0x80 + ((u & 0x0fc0) >> 6), 0x80 + (u & 0x003f)]);
const blobs: Record<string, () => Blob> = {
  basic: () => new Blob(["foo"], { type: "text/x-bar" }),
  "unpaired high surrogate (invalid utf-8)": blobBytes(encodeCesu8([0xd800])),
  "unpaired low surrogate (invalid utf-8)": blobBytes(encodeCesu8([0xdc00])),
  "paired surrogates (invalid utf-8)": blobBytes(encodeCesu8([0xd800, 0xdc00])),
  empty: () => new Blob([""]),
  NUL: () => new Blob(["\u0000"]),
};
for (const [label, make] of Object.entries(blobs)) {
  check(`Blob ${label}`, make, { copies: byReference, clone: byReference });
}
check("File basic", () => new File(["foo"], "bar", { type: "text/x-bar", lastModified: 42 }), {
  copies: byReference,
  clone: byReference,
});

check("Array sparse", () => new Array(10));
check("Array with non-index property", () => Object.assign([], { foo: "bar" }));
check("Object with index property and length", () => ({ "0": "foo", length: 1 }));
check(
  "Array with circular reference",
  () => {
    const rv: unknown[] = [];
    rv[0] = rv;
    return rv;
  },
  { circular: true },
);
check(
  "Object with circular reference",
  () => {
    const rv: Record<string, unknown> = {};
    rv["x"] = rv;
    return rv;
  },
  { circular: true },
);
check("Array with identical property values", () => {
  const obj = {};
  return [obj, obj];
});
check("Object with identical property values", () => {
  const obj = {};
  return { x: obj, y: obj };
});

// The constructor is shared, so that two calls build instances of one class.
function Foo(): void {}
Foo.prototype = { foo: "bar" };
check("Object with property on prototype", () => new (Foo as unknown as new () => object)());
const withProperty = (attributes: PropertyDescriptor) => () =>
  Object.defineProperty({}, "foo", { value: "bar", enumerable: true, writable: true, configurable: true, ...attributes });
check("Object with non-enumerable property", withProperty({ enumerable: false }));
check("Object with non-writable property", withProperty({ writable: false }));
check("Object with non-configurable property", withProperty({ configurable: false }));
check("ObjectPrototype must lose its exotic-ness when cloned", () => Object.prototype);

class FileSubclass extends File {}
check("A subclass instance will deserialize as its closest serializable superclass", () => new FileSubclass([], ""), {
  copies: byReference,
  clone: byReference,
});

// Resizable and growable buffers are ES2024, past the repo's ES2023 lib.
type Resizable = ArrayBuffer & { resize(byteLength: number): void };
const Growing = <T>(constructor: unknown) =>
  constructor as new (byteLength: number, options: { maxByteLength: number }) => T;
const resizable = () => new (Growing<Resizable>(ArrayBuffer))(16, { maxByteLength: 1024 });
check("Resizable ArrayBuffer", resizable);
check(
  "Growable SharedArrayBuffer",
  () => new (Growing<SharedArrayBuffer>(SharedArrayBuffer))(16, { maxByteLength: 1024 }),
  { copies: byReference, clone: byReference },
);
check("Length-tracking TypedArray", () => new Uint8Array(resizable()));
check("Length-tracking DataView", () => new DataView(resizable()));
check(
  "OOB TypedArray",
  () => {
    const ab = resizable();
    const ta = new Uint8Array(ab, 8);
    ab.resize(0);
    return ta;
  },
  { clone: { throws: "serializing an out-of-bounds view throws DataCloneError" } },
);
check(
  "OOB DataView",
  () => {
    const ab = resizable();
    const dv = new DataView(ab, 8);
    ab.resize(0);
    return dv;
  },
  { clone: { throws: "serializing an out-of-bounds view throws DataCloneError" } },
);

export const wptCorpus = entries;

/** Upstream's "Object with a getter that throws", which no hash or clone can read. */
export const wptThrowingGetter = (exception: Error) => ({
  get testProperty(): never {
    throw exception;
  },
});
