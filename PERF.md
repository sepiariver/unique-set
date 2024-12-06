# Performance

Comparison against the native Set is irrelevant. Not only does it lack value deduplication, it's so much faster it makes comparison meaningless.

BloomSet was initialized with the default sized bit array `6553577` and either `1` or `7` hash iterations.

All timing is expressed in milliseconds.

## Shallow Data

Shallow plain objects and Arrays, with 5 - 10% duplicates

### BloomSet hashCount: 1

Trial 1

| Count | Unique   | Bloom   |
| ----- | -------- | ------- |
| 400   | 10.17    | 8.79    |
| 1000  | 49.37    | 10.46   |
| 20000 | 19812.43 | 2530.15 |

Trial 2

| Count | Unique   | Bloom   |
| ----- | -------- | ------- |
| 400   | 10.06    | 8.75    |
| 1000  | 48.99    | 10.36   |
| 20000 | 19663.32 | 2536.92 |

It's clear BloomSet has something to offer starting at just a few hundred elements.

### BloomSet hashCount: 7

Trial 1

| Count | Unique   | Bloom   |
| ----- | -------- | ------- |
| 400   | 10.53    | 9.65    |
| 1000  | 48.60    | 10.39   |
| 20000 | 19242.54 | 2490.88 |

Trial 2

| Count | Unique   | Bloom   |
| ----- | -------- | ------- |
| 400   | 9.79     | 9.02    |
| 1000  | 48.85    | 10.49   |
| 20000 | 19255.17 | 2489.50 |

Performance is fairly stable and predictable with small datasets of shallow objects, regardless of hashCount.

## Nested Data

Plain objects and Arrays nested 1 or 2 levels deep, with 10-20% duplicates.

### BloomSet hashCount: 1

Trial 1

| Count | Unique   | Bloom   |
| ----- | -------- | ------- |
| 400   | 26.32    | 12.78   |
| 1000  | 91.30    | 16.86   |
| 20000 | 37671.41 | 5116.11 |

Trial 2

| Count | Unique   | Bloom   |
| ----- | -------- | ------- |
| 400   | 21.15    | 12.65   |
| 1000  | 115.2    | 16.33   |
| 20000 | 37169.66 | 5031.50 |

UniqueSet starts to suffer on > 1000 elements. It gets exponentially worse, especially with nested objects. Whereas BloomSet's optimizations keep it in the realm of usable at 20k elements. Subjectively I feel I'm willing to spend 5 seconds processing 20k elements if I need guaranteed uniqueness-by-value (but not 30 seconds).

### BloomSet hashCount: 7

Trial 1

| Count | Unique   | Bloom   |
| ----- | -------- | ------- |
| 400   | 20.58    | 13.57   |
| 1000  | 91.23    | 16.81   |
| 20000 | 37639.03 | 5151.90 |

Running 7 hashes doesn't add a lot of clock time for BloomSet, even with nested objects. Rather than recalculating the hash over the entire serialized value, BloomSet does some bit-mixing to distribute the value's representation across the bit array.

Trial 2

| Count | Unique   | Bloom   |
| ----- | -------- | ------- |
| 400   | 22.86    | 13.48   |
| 1000  | 94.64    | 17.80   |
| 20000 | 37673.08 | 5276.09 |

## Large (relatively)

Still using the nested dataset. Very roughly 15% duplicates, distributed in a contrived manner using modulo.

### hashCount: 7, size: 6553577

Trial 1

| Count  | Unique     | Bloom      |
| ------ | ---------- | ---------- |
| 100000 | 982,727.79 | 142,716.46 |

```txt
UniqueSet size: 100000 Expected size: 100000
BloomSet size: 100000 Expected size: 100000
Native Set size: 114458 Expected size: 114458
```

With a (relatively) large dataset, UniqueSet is slow enough to make me not want to test it again. It might be possible to squeeze extra performance from BloomSet by tweaking the config options.

Trial 2

| Count  | Unique     | Bloom      |
| ------ | ---------- | ---------- |
| 100000 | n/a        | 149600.27  |

### hashCount: 1, size: 6553577

Trial 1

| Count  | Unique     | Bloom      |
| ------ | ---------- | ---------- |
| 100000 | n/a        | 135919.53  |

Trial 2

| Count  | Unique     | Bloom      |
| ------ | ---------- | ---------- |
| 100000 | n/a        | 135913.43  |

Reducing the hashCount predictably improves performance by 5-10%. Collisions fallback to `fast-deep-equal`, so we can tolerate false positives unless performance degrades.

#### hashCount: 1, size: 28755000

Trial 1

| Count  | Unique     | Bloom      |
| ------ | ---------- | ---------- |
| 100000 | n/a        | 128660.39  |

Trial 2

| Count  | Unique     | Bloom      |
| ------ | ---------- | ---------- |
| 100000 | n/a        | 127663.77  |

Using a larger bit array requires more memory: ~3.5Mb in this case, still extremely memory-efficient for what it's doing. It seems to yield something like 5% clock time improvement over a smaller array, possibly due to decreased false positives, leading to less invocations of `fast-deep-equal` for deep comparison.
