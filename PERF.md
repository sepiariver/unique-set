# Performance

Benchmarks run with `npm run bench` on Node.js v20.18.1, Apple M2 Pro.

## Flat Data (`bench.spec.ts`)

Mixed strings, flat objects (2 keys), and 2-element arrays with ~10-15% duplicate rate.

|   Items | MapSet `add()` | Native Set | Overhead |
| ------: | -------------: | ---------: | -------: |
|     400 |        1.23 ms |    0.04 ms |     ~31x |
|   1,000 |        1.46 ms |    0.18 ms |      ~8x |
|  20,000 |       13.09 ms |    1.46 ms |      ~9x |
| 100,000 |       54.08 ms |    6.44 ms |      ~8x |

## Nested Data (`bench-nested.spec.ts`)

Deeply nested objects (3-4 levels), nested arrays with objects, and mixed structures.

### `add()` - insert all items

|   Items |   MapSet | Native Set | Overhead |
| ------: | -------: | ---------: | -------: |
|     400 |  1.80 ms |    0.03 ms |     ~60x |
|   1,000 |  3.01 ms |    0.05 ms |     ~60x |
|  20,000 | 14.23 ms |    0.89 ms |     ~16x |
| 100,000 | 80.60 ms |    3.80 ms |     ~21x |

### `has()` - query all items (50% hits, 50% misses)

|   Items | `has()` time | Queries |   Hits | per query |
| ------: | -----------: | ------: | -----: | --------: |
|     400 |      0.96 ms |     457 |    228 |   ~2.1 us |
|   1,000 |      0.95 ms |   1,144 |    572 |   ~0.8 us |
|  20,000 |     16.86 ms |  22,892 | 11,446 |   ~0.7 us |
| 100,000 |     73.89 ms | 114,458 | 57,229 |   ~0.6 us |

## Notes

- Native `Set` uses reference equality and cannot deduplicate objects/arrays by value. The overhead shown is the cost of deep value comparison.
- MapSet uses a streaming 32-bit FNV-1a structural hash with `fast-deep-equal` fallback for hash collisions.
- At 20,000 items, ~47 hash collisions are expected (birthday paradox). These are handled correctly with no impact on results.
- The `has()` cost per query decreases at larger sizes due to V8 JIT warmup.
