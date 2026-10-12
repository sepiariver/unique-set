# Performance

The flat and nested sections compare **UniqueSet** (`@sepiariver/unique-set`), **DeepSet** (`deep-equality-data-structures`), and the native `Set`. They were run with `npm run bench` on Node.js v20.18.1, Apple M2 Pro. The [competitors](#competitors-competitorsbenchts) section states its own environment.

## Flat Data (`bench.spec.ts`)

Mixed strings, flat objects (2 keys), and 2-element arrays with ~10-15% duplicate rate.

|   Items | UniqueSet |   DeepSet | Native Set |
| ------: | --------: | --------: | ---------: |
|     400 |   0.96 ms |   8.13 ms |    0.07 ms |
|   1,000 |   0.60 ms |   9.33 ms |    0.08 ms |
|  20,000 |   6.12 ms | 116.00 ms |    1.00 ms |
| 100,000 |  20.83 ms | 517.00 ms |    4.15 ms |

## Nested Data (`bench-nested.spec.ts`)

Deeply nested objects (3-4 levels), nested arrays with objects, and mixed structures.

### `add()` — insert all items

|   Items | UniqueSet |     DeepSet | Native Set |
| ------: | --------: | ----------: | ---------: |
|     400 |   1.90 ms |    14.88 ms |    0.05 ms |
|   1,000 |   0.72 ms |    22.39 ms |    0.05 ms |
|  20,000 |   9.73 ms |   423.00 ms |    0.89 ms |
| 100,000 |  57.18 ms | 2,130.00 ms |    3.88 ms |

### `has()` — query all items (50% hits, 50% misses)

|   Items | UniqueSet.has() | DeepSet.has() | Queries |   Hits |
| ------: | --------------: | ------------: | ------: | -----: |
|     400 |         0.63 ms |       8.93 ms |     457 |    228 |
|   1,000 |         0.73 ms |      21.69 ms |   1,144 |    572 |
|  20,000 |        12.83 ms |     425.00 ms |  22,892 | 11,446 |
| 100,000 |        61.26 ms |   2,111.00 ms | 114,458 | 57,229 |

## Competitors (`competitors.bench.ts`)

Run with `npm run bench-competitors` on Node.js v24.14.0, Apple M5 Pro, using vitest 4.1.11 `bench`. Times are the mean for one full deduplication pass over the workload, and the fastest result in each row is in bold.

The workload data is ported from each library's own benchmark suite. Provenance and licences are in the headers of the files in `test/fixtures/`. Most workloads contain every unique value once plus a duplicate whose object keys and Set/Map insertion order are reversed. The ohash workloads instead reuse upstream's presets, which are shallow copies of a single object. Before timing, each library's result size is checked against the workload's known unique count, and a crash or wrong count is reported in place of a timing.

| Workload                             |    UniqueSet |   DeepSet | immutable | @rimbu/hashed | ohash + Map | hash-it + Map | lodash `uniqWith` |
| :----------------------------------- | -----------: | --------: | --------: | ------------: | ----------: | ------------: | ----------------: |
| hash-it records, 5,000 unique        | **10.23 ms** | 274.95 ms |  91.81 ms |      24.90 ms |    32.59 ms |      22.19 ms |                 — |
| hash-it records, 1,000 unique        |  **1.97 ms** |  53.69 ms |  17.52 ms |       4.16 ms |     5.29 ms |       3.45 ms |         304.64 ms |
| hash-it stairs, 100 deep, 200 unique |  **1.54 ms** | 100.01 ms |  17.48 ms |       4.96 ms |     3.43 ms |       3.17 ms |       2,356.72 ms |
| lodash near-misses, 1,000 unique     |  **2.47 ms** |  85.13 ms |  26.62 ms |       5.89 ms |     5.42 ms |       3.64 ms |         676.89 ms |
| ohash small, 1,024 copies            |  **0.21 ms** |   8.46 ms |   1.65 ms |       0.37 ms |     0.98 ms |       0.29 ms |           0.25 ms |
| ohash small circular, 1,024 copies   |          ✗ ¹ |  14.66 ms |       ✗ ² |           ✗ ¹ |     1.47 ms |       0.66 ms |       **0.27 ms** |
| ohash large, 512 copies              |      1.81 ms |       ✗ ³ |  11.79 ms |       4.60 ms |     4.64 ms |       2.73 ms |       **0.63 ms** |
| ohash large circular, 512 copies     |          ✗ ¹ |       ✗ ³ |       ✗ ² |           ✗ ¹ |   407.39 ms |     546.23 ms |       **0.60 ms** |

The ✗ entries failed before timing, with these errors:

1. `RangeError: Maximum call stack size exceeded`, from recursing into the circular reference.
2. `TypeError: Cannot convert circular structure to Immutable`.
3. `Error: Unknown object type "asyncgeneratorfunction"`. DeepSet cannot hash the async generator function in ohash's large preset.

A dash (—) means the workload was not run. lodash compares every pair of items, so the benchmark caps it at 2,000 items.

Findings:

- UniqueSet is the fastest on every workload without circular references except ohash large. Its margin over the next library ranges from 1.2× to 2.2×, and the next library is usually hash-it + Map.
- On ohash large, lodash is 2.9× faster than UniqueSet. [Unverified] The likely cause is that every item is a shallow copy of one object, so `isEqual` compares each item against the single kept value and short-circuits on the shared nested references. UniqueSet hashes each item's full structure first. This has not been profiled.
- UniqueSet does not yet support circular references, and neither do immutable or @rimbu/hashed.
- Every library that completed a workload returned the expected size. @rimbu/hashed's deep context treats Set and Map insertion order, and `0` versus `-0`, differently from UniqueSet, but none of these workloads exercise those cases.
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

## Notes

- **Native `Set`** uses reference equality and cannot deduplicate objects/arrays by value.
- **UniqueSet** (this package) uses a streaming 32-bit FNV-1a structural hash and confirms every hash match with `fast-equals` (see [Collision safety](#collision-safety)). O(1) average for both `add()` and `has()`.
- **DeepSet** (`deep-equality-data-structures`) hashes values with `object-hash` (MD5 by default) for O(1) lookups. The performance gap comes from MD5 being a cryptographic hash and `object-hash` serializing values before hashing.
- UniqueSet is roughly **25–35x faster** than DeepSet on nested data at scale, while both produce identical deduplication results.
