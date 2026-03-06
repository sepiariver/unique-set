# Performance

Benchmarks run with `npm run bench` on Node.js v20.18.1, Apple M2 Pro.

Comparison between **UniqueSet** (`@sepiariver/unique-set`), **DeepSet** (`deep-equality-data-structures`), and the native `Set`.

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

## Notes

- **Native `Set`** uses reference equality and cannot deduplicate objects/arrays by value.
- **UniqueSet** (this package) uses a streaming 32-bit FNV-1a structural hash with `fast-deep-equal` only as fallback for hash collisions. O(1) average for both `add()` and `has()`.
- **DeepSet** (`deep-equality-data-structures`) hashes values with `object-hash` (MD5 by default) for O(1) lookups. The performance gap comes from MD5 being a cryptographic hash and `object-hash` serializing values before hashing.
- UniqueSet is roughly **25–35x faster** than DeepSet on nested data at scale, while both produce identical deduplication results.
