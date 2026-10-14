// Shared helpers for competitors.bench.ts: deterministic data and duplicate generation.

/** Seeded PRNG (mulberry32) so every run benchmarks identical data. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)] as T;
}

/**
 * Deep copy that is value-equal under unique-set semantics but structurally reshuffled:
 * plain-object keys and Set/Map insertion order are reversed, array order is kept, and array
 * holes become `undefined`, which fast-equals reads them as.
 * Anything else (functions, class instances, typed arrays) is shared by reference.
 */
export function mirror<T>(value: T): T {
  if (Array.isArray(value)) return Array.from(value, mirror) as T;
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (value instanceof Set) return new Set([...value].reverse().map(mirror)) as T;
  if (value instanceof Map) {
    return new Map([...value].reverse().map(([k, v]) => [mirror(k), mirror(v)])) as T;
  }
  if (value !== null && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto === Object.prototype || proto === null) {
      // Object.prototype has a null prototype, but its own `constructor` makes it a plain object.
      const out: Record<string, unknown> = value === Object.prototype ? {} : Object.create(proto);
      for (const key of Object.keys(value).reverse()) {
        out[key] = mirror((value as Record<string, unknown>)[key]);
      }
      return out as T;
    }
  }
  return value;
}

/** Each base value once plus one duplicate (a mirrored copy by default), shuffled deterministically. */
export function withMirroredDuplicates<T>(base: T[], seed: number, copy: (value: T) => T = mirror): T[] {
  const items = [...base, ...base.map((value) => copy(value))];
  const rng = createRng(seed);
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j] as T, items[i] as T];
  }
  return items;
}

export interface Workload {
  name: string;
  items: unknown[];
  /** Number of distinct values under unique-set semantics, known by construction. */
  expectedSize: number;
}
