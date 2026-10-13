# Performance

This page compares **UniqueSet** (`@sepiariver/unique-set` 3.3.0) with other ways to deduplicate JavaScript values by deep equality.

## Method

- **Command:** `npm run bench`, which builds the package and runs `test/competitors.bench.ts` with `vitest bench`.
- **Environment:** Node.js v24.14.0, Apple M5 Pro, vitest 4.1.11, measured 2026-10-12.
- **Statistic:** the mean time for one full pass over the workload, after tinybench's defaults of at least 5 warm-up and 10 timed iterations. The fastest result in each row is in bold.
- **Correctness gate:** before timing, each library's result (the set size, or the number of `has()` hits) is checked against a count known by construction. A crash or a wrong count is reported in place of a timing.
- **Scope:** all libraries run in one process, one after another. Compare rows on one machine, not absolute times across machines.

The workloads come from two places:

- **This repo's datasets** (`test/fixtures/datasets.ts`): 20,000 unique values plus 2,892 duplicates. The flat dataset mixes strings, 2-key objects and 2-element arrays; the nested dataset holds objects nested 3–4 levels, arrays of objects, and mixed structures. Each duplicate is a mirrored copy, with object keys in reverse order.
- **Ported from other projects' benchmark and test suites** (`test/fixtures/`, provenance and licences in each file's header). The hash-it, lodash and superjson workloads hold every unique value once plus a mirrored duplicate, with object keys and Set/Map insertion order reversed. The ohash workloads instead reuse upstream's presets, which are shallow copies of a single object.
- **The value mix** repeats, five times, every value from WPT's structured clone battery and devalue's and superjson's round-trip fixtures that equals its own structured clone and is neither circular nor larger than 1,000 elements: 189 values, wrapped as `{ round, entry, value }` so that each record is distinct. Each duplicate is a mirrored `structuredClone`, so it shares no reference with its original. The same values drive `test/corpus.spec.ts`.
- **devalue URLSearchParams** holds 1,000 `URLSearchParams`, each repeated by reference.

## Deduplication

Time to build a deduplicated collection from every item in the workload.

| Workload | UniqueSet | DeepSet | immutable | @rimbu/hashed | ohash + Map | hash-it + Map | lodash `uniqWith` |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| flat mixed, 20,000 unique | **1.73 ms** | 64.99 ms | 16.42 ms | 10.91 ms | 10.91 ms | 3.73 ms | — |
| nested, 20,000 unique | **4.77 ms** | 293.78 ms | 56.64 ms | 25.08 ms | 21.82 ms | 13.16 ms | — |
| hash-it records, 5,000 unique | **12.33 ms** | 305.85 ms | 105.15 ms | 29.26 ms | 33.12 ms | 22.94 ms | — |
| hash-it records, 1,000 unique | **2.45 ms** | 63.00 ms | 19.69 ms | 5.10 ms | 5.96 ms | 4.12 ms | 350.53 ms |
| hash-it stairs, 100 deep, 200 unique | **1.74 ms** | 114.83 ms | 21.51 ms | 5.64 ms | 4.01 ms | 4.02 ms | 2,575.19 ms |
| lodash near-misses, 1,000 unique | **2.79 ms** | 93.42 ms | 31.05 ms | 7.17 ms | 5.76 ms | 4.05 ms | 789.59 ms |
| superjson Date records, 1,000 unique | **9.69 ms** | 413.08 ms | 78.92 ms | 25.16 ms | 88.79 ms | 21.67 ms | 583.80 ms |
| value mix, 945 unique | **0.58 ms** | ✗ ⁴ | ✗ 1,095 ⁶ | ✗ 1,000 ⁶ | ✗ ⁵ | ✗ 950 ⁶ | ✗ 960 ⁶ |
| devalue URLSearchParams, 1,000 unique | **0.21 ms** | ✗ ⁴ | ✗ 1 ⁶ | 1.50 ms | 1.49 ms | ✗ 1 ⁶ | 328.02 ms |
| ohash small, 1,024 copies | **0.10 ms** | 9.25 ms | 1.90 ms | 0.42 ms | 1.09 ms | 0.32 ms | 0.27 ms |
| ohash small circular, 1,024 copies | **0.19 ms** | 15.99 ms | ✗ ² | ✗ ¹ | 1.64 ms | 0.74 ms | 0.30 ms |
| ohash large, 512 copies | **0.54 ms** | ✗ ³ | 13.36 ms | 5.41 ms | 5.04 ms | 3.03 ms | 0.68 ms |
| ohash large circular, 512 copies | 0.96 ms | ✗ ³ | ✗ ² | ✗ ¹ | 445.34 ms | 613.72 ms | **0.68 ms** |

## Lookup

Time to call `has()` once for every item in the nested dataset, on a collection built (untimed) from its first half. Each query is a fresh mirrored copy, so no lookup succeeds by reference. Converting the query is part of each lookup for immutable, and hashing it is part of each lookup for the hash-keyed `Map` libraries.

| Lookup workload | UniqueSet | DeepSet | immutable | @rimbu/hashed | ohash + Map | hash-it + Map | lodash `isEqual` scan |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| nested, 11,446 stored, 22,892 queries (11,446 hits) | **6.15 ms** | 297.13 ms | 63.96 ms | 15.42 ms | 20.52 ms | 12.05 ms | — |

## Failures and skipped runs

The ✗ entries failed before timing, with these errors:

1. `RangeError: Maximum call stack size exceeded`, from recursing into the circular reference.
2. `TypeError: Cannot convert circular structure to Immutable`.
3. `Error: Unknown object type "asyncgeneratorfunction"`. DeepSet cannot hash the async generator function in ohash's large preset.
4. `Error: Unknown object type "biguint64array"` on the value mix, and `"urlsearchparams"` on the URLSearchParams workload.
5. `Error: Cannot serialize Number`. ohash cannot hash boxed primitives (`new Number(…)`, and likewise `String`, `Boolean` and `BigInt` wrappers) or `DataView`s.
6. A wrong size, shown in the cell, which [Semantic differences](#semantic-differences) explains.

A dash (—) means the workload was not run. lodash compares every pair of items when deduplicating and scans every stored item on each lookup, so the benchmark caps it at 2,000 items.

## Findings

- UniqueSet is the fastest on every workload except ohash large circular. Where another library also completes the workload correctly, its margin over the next library ranges from 1.25× to 2.8× for deduplication, is 7.0× on devalue URLSearchParams, and is 2.0× for lookup. The next library is hash-it + Map on this repo's, hash-it's, lodash's and superjson's workloads (ohash + Map ties it on hash-it stairs), ohash + Map on devalue URLSearchParams, and lodash on ohash's.
- Against DeepSet, UniqueSet is 25× to 91× faster for deduplication and 48× faster for lookup.
- UniqueSet is the only library that returns the expected size on the value mix. See [Semantic differences](#semantic-differences).
- `fast-equals` compares a `URLSearchParams` by reference, so UniqueSet hashes each one by its identity and gives it its own key (see [objects compared by reference](README.md#considerations)).
- Every ohash workload is shallow copies of one object, so the copies share every nested value by reference. lodash compares each copy against the one value it keeps, and `isEqual` stops at each shared reference with `===`. UniqueSet checks a shallow copy of the value it last matched the same way before hashing it (see [Notes](#notes)), so it leads on three of the four ohash workloads.
- On ohash large circular, lodash is 1.4× faster (0.68 ms against 0.96 ms). UniqueSet has to hash the first two copies to store one and recognise the other, and hashing one circular copy of this preset takes 205 µs (measured separately on the same machine), which accounts for the gap. These copies take the depth-limited path described under [Circular references](README.md#considerations).
- UniqueSet completes both circular workloads. On the large preset it is 466× faster than ohash + Map and 642× faster than hash-it + Map. immutable and @rimbu/hashed do not support circular references.
- Outside the value mix and the URLSearchParams workload, every library that completed a workload returned the expected size or hit count.
- The hash-keyed `Map` libraries never check equality, which is part of why they are fast. See [Collision safety](#collision-safety).

## Semantic differences

The expected sizes follow UniqueSet's semantics, which are those of `fast-equals` (see [Considerations](README.md#considerations)). A library that returns another size compares some values differently, which is not necessarily a defect. Comparing each value in the mix with its mirrored structured clone, one pair at a time, these libraries keep the pair apart:

| Library | Values whose clone it keeps apart | Why |
| :--- | :--- | :--- |
| immutable `Set(fromJS)` | 30, mostly objects other than plain objects and arrays, such as every `RegExp`, `Error`, `ArrayBuffer` and `DataView` | `fromJS` leaves those objects unconverted, so they compare by reference. |
| DeepSet | 15, plus 4 holding `BigInt64Array` or `BigUint64Array`, which throw | 10 reuse one reference in two places: DeepSet keeps `[o, o]` apart from an equal `[{ ...o }, { ...o }]`. 3 are sparse arrays, whose mirrors hold `undefined` in place of holes. 2 are objects whose prototype is not `Object.prototype`, whose clones are plain objects. |
| @rimbu/hashed HashSet (deep) | 11: 10 holding a `Set` or `Map`, and 1 object whose prototype is not `Object.prototype` | The mirror reverses insertion order, which this context compares. The object differs from its plain-object clone. |
| lodash `isEqual` | 3, each holding a boxed `BigInt` | `isEqual` returns `false` for two equal `Object(1n)` values that are not the same reference. |
| hash-it + Map | 1, an array with a non-index property | hash-it hashes the property, which `fast-equals` ignores and the mirror drops. |

On the URLSearchParams workload, immutable and hash-it + Map return a size of 1. hash-it gives every `URLSearchParams` the same hash, so the `Map` keeps the first and silently drops the other 999, a case of the [collision](#collision-safety) problem below.

## Collision safety

A library that keys values by a hash alone treats two distinct values with the same hash as duplicates. `add()` silently drops the second value, and `has()` reports a value as present when it is not. A library that confirms every hash match with an equality check gets a correct result whatever the hash quality, and collisions only cost time.

| Library                      | Hash                                  | Hash match confirmed by equality?                        | Effect of a collision                  |
| :--------------------------- | :------------------------------------ | :------------------------------------------------------- | :------------------------------------- |
| **UniqueSet**                | 32-bit structural hash                | Yes: `fast-equals` `deepEqual` in `add`, `has`, `delete` | Extra comparison; never a wrong result |
| @rimbu/hashed (deep context) | `Hasher.anyDeepHasher()`              | Yes: `Eq.anyDeepEq()`                                    | Extra comparison; never a wrong result |
| immutable `Set(fromJS)`      | `hashCode`                            | Yes: `is()`                                              | Extra comparison; never a wrong result |
| DeepSet                      | `object-hash` digest (MD5 by default) | No: the digest is the native `Map` key                   | Distinct value lost                    |
| ohash + `Map`                | SHA-256, base64url                    | No                                                       | Distinct value lost                    |
| hash-it + `Map`              | 53-bit integer                        | No                                                       | Distinct value lost                    |
| lodash `uniqWith(isEqual)`   | None                                  | Not applicable: every pair is compared                   | Cannot collide; O(n²)                  |

UniqueSet compares a value nested past 256 levels, which includes every circular value, with a corrected copy of `circularDeepEqual`. The duplicate check described in [Notes](#notes) uses `shallowEqual`, which returns `true` only for values that `deepEqual` also accepts.

With a 128-bit or 256-bit digest, a collision is vanishingly unlikely in practice, although nothing in the design rules it out. A 53-bit hash is a different matter: by the birthday bound, 10 million distinct values have about a 0.55% chance of at least one collision. UniqueSet's 32-bit hash collides far more often (see the collision estimate in the [README](README.md#considerations)), which is why it confirms every match.

## Scale test

`npm run bench-large` runs `test/bench-large.spec.ts`, an opt-in test outside the method above. It adds 5,000,998 nested items (5,000,000 unique, from the same generator as the nested dataset) to a UniqueSet and to a native `Set`, timing one pass of each. Native `Set` compares by reference, so it keeps every item and serves only as a floor. The script raises the Node.js heap limit to 4 GB.

One run in the environment from [Method](#method): UniqueSet 2,379 ms, native `Set` 209 ms.

## Notes

- **UniqueSet** uses a streaming 32-bit FNV-1a structural hash and confirms every hash match with `fast-equals` (see [Collision safety](#collision-safety)). O(1) average for both `add()` and `has()`. After `add()` finds a duplicate, the next `add()` first compares the new value with the stored value it matched using `fast-equals` `shallowEqual`, which checks top-level members by reference. A shallow copy of that value is then recognised without being hashed, and any other value fails the check after its top level.
- **DeepSet** (`deep-equality-data-structures`) hashes values with `object-hash` (MD5 by default) for O(1) lookups. The performance gap comes from MD5 being a cryptographic hash and `object-hash` serializing values before hashing.
