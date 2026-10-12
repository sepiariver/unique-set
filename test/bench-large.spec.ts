// Opt-in scale test (`npm run bench-large`): 5 million nested values, timed once against the native
// Set as a floor. Native Set compares by reference, so it keeps every item, duplicates included.
import { MapSet } from "../dist/index.mjs";
import { describe, it, expect } from "vitest";
import { nestedDataset } from "./fixtures/datasets";

function findNextPrime(num: number): number {
  if (num < 2) return 2;
  if ((num & 1) === 0) num++;
  while (true) {
    let isPrime = true;
    const sqrt = Math.sqrt(num);
    for (let i = 3; i <= sqrt; i += 2) {
      if (num % i === 0) {
        isPrime = false;
        break;
      }
    }
    if (isPrime) return num;
    num += 2;
  }
}

function measure(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

describe("Performance Benchmarks - Large Scale", () => {
  const datasetSize = 5_000_000;
  // Duplicate roughly one value in 5,000 per kind, so the set grows to nearly the full size.
  const prime1 = findNextPrime(Math.floor(datasetSize * 0.001));
  const prime2 = findNextPrime(prime1 + 1);
  const prime3 = findNextPrime(prime2 + 1);
  const { items, expectedSize } = nestedDataset(datasetSize, [prime1, prime2, prime3]);

  it(`MapSet vs native Set: ${datasetSize}`, () => {
    const map = new MapSet();
    const native = new Set();

    const mapTime = measure(() => items.forEach((el) => map.add(el)));
    const nativeTime = measure(() => items.forEach((el) => native.add(el)));

    console.log(
      `MapSet: ${mapTime.toFixed(2)} ms | Native Set: ${nativeTime.toFixed(2)} ms | ${items.length} items`
    );

    expect(map.size).toBe(expectedSize);
    expect(native.size).toBe(items.length);
  });
});
