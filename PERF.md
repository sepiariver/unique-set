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
- **Ported from other libraries' benchmark suites** (`test/fixtures/`, provenance and licences in each file's header). The hash-it and lodash workloads hold every unique value once plus a mirrored duplicate, with object keys and Set/Map insertion order reversed. The ohash workloads instead reuse upstream's presets, which are shallow copies of a single object.

## Deduplication

Time to build a deduplicated collection from every item in the workload.

| Workload | UniqueSet | DeepSet | immutable | @rimbu/hashed | ohash + Map | hash-it + Map | lodash `uniqWith` |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| flat mixed, 20,000 unique | **1.38 ms** | 63.66 ms | 13.47 ms | 9.27 ms | 9.32 ms | 3.02 ms | — |
| nested, 20,000 unique | **4.08 ms** | 265.85 ms | 50.93 ms | 21.75 ms | 18.85 ms | 11.49 ms | — |
| hash-it records, 5,000 unique | **10.61 ms** | 274.49 ms | 89.48 ms | 22.68 ms | 29.11 ms | 18.78 ms | — |
| hash-it records, 1,000 unique | **2.03 ms** | 52.37 ms | 17.00 ms | 4.23 ms | 5.24 ms | 3.56 ms | 307.00 ms |
| hash-it stairs, 100 deep, 200 unique | **1.53 ms** | 97.96 ms | 17.76 ms | 5.02 ms | 3.49 ms | 3.54 ms | 2,362.33 ms |
| lodash near-misses, 1,000 unique | **2.49 ms** | 80.40 ms | 26.27 ms | 5.85 ms | 5.38 ms | 3.73 ms | 679.13 ms |
| ohash small, 1,024 copies | **0.20 ms** | 8.62 ms | 1.73 ms | 0.38 ms | 0.98 ms | 0.29 ms | 0.25 ms |
| ohash small circular, 1,024 copies | ✗ ¹ | 14.29 ms | ✗ ² | ✗ ¹ | 1.57 ms | 0.67 ms | **0.27 ms** |
| ohash large, 512 copies | 1.79 ms | ✗ ³ | 11.40 ms | 4.52 ms | 4.68 ms | 2.78 ms | **0.62 ms** |
| ohash large circular, 512 copies | ✗ ¹ | ✗ ³ | ✗ ² | ✗ ¹ | 403.63 ms | 536.39 ms | **0.61 ms** |

## Lookup

Time to call `has()` once for every item in the nested dataset, on a collection built (untimed) from its first half. Each query is a fresh mirrored copy, so no lookup succeeds by reference. Converting the query is part of each lookup for immutable, and hashing it is part of each lookup for the hash-keyed `Map` libraries.

| Lookup workload | UniqueSet | DeepSet | immutable | @rimbu/hashed | ohash + Map | hash-it + Map | lodash `isEqual` scan |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| nested, 11,446 stored, 22,892 queries (11,446 hits) | **5.03 ms** | 270.46 ms | 53.41 ms | 13.05 ms | 18.46 ms | 10.37 ms | — |

## Failures and skipped runs

The ✗ entries failed before timing, with these errors:

1. `RangeError: Maximum call stack size exceeded`, from recursing into the circular reference.
2. `TypeError: Cannot convert circular structure to Immutable`.
3. `Error: Unknown object type "asyncgeneratorfunction"`. DeepSet cannot hash the async generator function in ohash's large preset.

A dash (—) means the workload was not run. lodash compares every pair of items when deduplicating and scans every stored item on each lookup, so the benchmark caps it at 2,000 items.

## Findings

- UniqueSet is the fastest on every workload without circular references except ohash large. Its margin over the next library ranges from 1.2× to 2.8× for deduplication and is 2.1× for lookup. The next library is usually hash-it + Map.
- Against DeepSet, UniqueSet is 26× to 65× faster for deduplication and 54× faster for lookup.
- On ohash large, lodash is 2.9× faster than UniqueSet. [Unverified] The likely cause is that every item is a shallow copy of one object, so `isEqual` compares each item against the single kept value and short-circuits on the shared nested references. UniqueSet hashes each item's full structure first. This has not been profiled.
- UniqueSet does not yet support circular references, and neither do immutable or @rimbu/hashed.
- Every library that completed a workload returned the expected size or hit count. @rimbu/hashed's deep context treats Set and Map insertion order, and `0` versus `-0`, differently from UniqueSet, but none of these workloads exercise those cases.
- The hash-keyed `Map` libraries never check equality, which is part of why they are fast. See [Collision safety](#collision-safety).

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

With a 128-bit or 256-bit digest, a collision is vanishingly unlikely in practice, although nothing in the design rules it out. A 53-bit hash is a different matter: by the birthday bound, 10 million distinct values have about a 0.55% chance of at least one collision. UniqueSet's 32-bit hash collides far more often (see the collision estimate in the [README](README.md#considerations)), which is why it confirms every match.

## Scale test

`npm run bench-large` runs `test/bench-large.spec.ts`, an opt-in test outside the method above. It adds 5,000,998 nested items (5,000,000 unique, from the same generator as the nested dataset) to a UniqueSet and to a native `Set`, timing one pass of each. Native `Set` compares by reference, so it keeps every item and serves only as a floor. The script raises the Node.js heap limit to 4 GB.

One run in the environment from [Method](#method): UniqueSet 1,904 ms, native `Set` 148 ms.

## Notes

- **UniqueSet** uses a streaming 32-bit FNV-1a structural hash and confirms every hash match with `fast-equals` (see [Collision safety](#collision-safety)). O(1) average for both `add()` and `has()`.
- **DeepSet** (`deep-equality-data-structures`) hashes values with `object-hash` (MD5 by default) for O(1) lookups. The performance gap comes from MD5 being a cryptographic hash and `object-hash` serializing values before hashing.
