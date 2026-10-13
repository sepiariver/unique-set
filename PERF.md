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
| flat mixed, 20,000 unique | **1.72 ms** | 71.84 ms | 15.73 ms | 11.14 ms | 10.90 ms | 3.57 ms | — |
| nested, 20,000 unique | **5.04 ms** | 302.76 ms | 58.57 ms | 24.51 ms | 21.76 ms | 12.94 ms | — |
| hash-it records, 5,000 unique | **13.11 ms** | 307.15 ms | 101.51 ms | 26.06 ms | 33.49 ms | 22.16 ms | — |
| hash-it records, 1,000 unique | **2.37 ms** | 60.79 ms | 19.29 ms | 4.90 ms | 6.18 ms | 3.92 ms | 350.69 ms |
| hash-it stairs, 100 deep, 200 unique | **1.95 ms** | 111.67 ms | 20.52 ms | 5.89 ms | 4.05 ms | 3.99 ms | 2,677.55 ms |
| lodash near-misses, 1,000 unique | **2.83 ms** | 95.17 ms | 31.69 ms | 6.88 ms | 6.16 ms | 4.16 ms | 805.36 ms |
| ohash small, 1,024 copies | **0.11 ms** | 10.26 ms | 2.06 ms | 0.45 ms | 1.16 ms | 0.34 ms | 0.29 ms |
| ohash small circular, 1,024 copies | **0.21 ms** | 16.81 ms | ✗ ² | ✗ ¹ | 1.76 ms | 0.79 ms | 0.32 ms |
| ohash large, 512 copies | **0.57 ms** | ✗ ³ | 13.93 ms | 5.36 ms | 5.37 ms | 3.21 ms | 0.71 ms |
| ohash large circular, 512 copies | 0.99 ms | ✗ ³ | ✗ ² | ✗ ¹ | 475.10 ms | 629.52 ms | **0.70 ms** |

## Lookup

Time to call `has()` once for every item in the nested dataset, on a collection built (untimed) from its first half. Each query is a fresh mirrored copy, so no lookup succeeds by reference. Converting the query is part of each lookup for immutable, and hashing it is part of each lookup for the hash-keyed `Map` libraries.

| Lookup workload | UniqueSet | DeepSet | immutable | @rimbu/hashed | ohash + Map | hash-it + Map | lodash `isEqual` scan |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| nested, 11,446 stored, 22,892 queries (11,446 hits) | **6.16 ms** | 308.91 ms | 64.15 ms | 15.32 ms | 21.70 ms | 11.75 ms | — |

## Failures and skipped runs

The ✗ entries failed before timing, with these errors:

1. `RangeError: Maximum call stack size exceeded`, from recursing into the circular reference.
2. `TypeError: Cannot convert circular structure to Immutable`.
3. `Error: Unknown object type "asyncgeneratorfunction"`. DeepSet cannot hash the async generator function in ohash's large preset.

A dash (—) means the workload was not run. lodash compares every pair of items when deduplicating and scans every stored item on each lookup, so the benchmark caps it at 2,000 items.

## Findings

- UniqueSet is the fastest on every workload except ohash large circular. Its margin over the next library ranges from 1.2× to 2.8× for deduplication and is 1.9× for lookup. The next library is hash-it + Map on this repo's, hash-it's and lodash's workloads, and lodash on ohash's.
- Against DeepSet, UniqueSet is 23× to 97× faster for deduplication and 50× faster for lookup.
- Every ohash workload is shallow copies of one object, so the copies share every nested value by reference. lodash compares each copy against the one value it keeps, and `isEqual` stops at each shared reference with `===`. UniqueSet checks a shallow copy of the value it last matched the same way before hashing it (see [Notes](#notes)), so it leads on three of the four ohash workloads.
- On ohash large circular, lodash is 1.4× faster (0.70 ms against 0.99 ms). UniqueSet has to hash the first two copies to store one and recognise the other, and hashing one circular copy of this preset takes 205 µs (measured separately on the same machine), which accounts for the gap. These copies take the depth-limited path described under [Circular references](README.md#considerations).
- UniqueSet completes both circular workloads. On the large preset it is 481× faster than ohash + Map and 638× faster than hash-it + Map. immutable and @rimbu/hashed do not support circular references.
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

UniqueSet compares a value nested past 256 levels, which includes every circular value, with a corrected copy of `circularDeepEqual`. The duplicate check described in [Notes](#notes) uses `shallowEqual`, which returns `true` only for values that `deepEqual` also accepts.

With a 128-bit or 256-bit digest, a collision is vanishingly unlikely in practice, although nothing in the design rules it out. A 53-bit hash is a different matter: by the birthday bound, 10 million distinct values have about a 0.55% chance of at least one collision. UniqueSet's 32-bit hash collides far more often (see the collision estimate in the [README](README.md#considerations)), which is why it confirms every match.

## Scale test

`npm run bench-large` runs `test/bench-large.spec.ts`, an opt-in test outside the method above. It adds 5,000,998 nested items (5,000,000 unique, from the same generator as the nested dataset) to a UniqueSet and to a native `Set`, timing one pass of each. Native `Set` compares by reference, so it keeps every item and serves only as a floor. The script raises the Node.js heap limit to 4 GB.

One run in the environment from [Method](#method): UniqueSet 2,379 ms, native `Set` 209 ms.

## Notes

- **UniqueSet** uses a streaming 32-bit FNV-1a structural hash and confirms every hash match with `fast-equals` (see [Collision safety](#collision-safety)). O(1) average for both `add()` and `has()`. After `add()` finds a duplicate, the next `add()` first compares the new value with the stored value it matched using `fast-equals` `shallowEqual`, which checks top-level members by reference. A shallow copy of that value is then recognised without being hashed, and any other value fails the check after its top level.
- **DeepSet** (`deep-equality-data-structures`) hashes values with `object-hash` (MD5 by default) for O(1) lookups. The performance gap comes from MD5 being a cryptographic hash and `object-hash` serializing values before hashing.
