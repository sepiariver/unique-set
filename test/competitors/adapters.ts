// One adapter per library: deduplicate `items` by value and return the resulting size.
import { MapSet } from "../../dist/index.mjs";
import { DeepSet } from "deep-equality-data-structures";
import { Set as ImmutableSet, fromJS } from "immutable";
import { HashSet, Hasher } from "@rimbu/hashed";
import { Eq } from "@rimbu/common";
import { hash as ohash } from "ohash";
import { hash as hashIt } from "hash-it";
import { uniqWith, isEqual } from "lodash";

export interface Adapter {
  name: string;
  run: (items: unknown[]) => number;
  /** Skip workloads larger than this; set for libraries that compare every pair. */
  maxItems?: number;
}

const rimbuDeep = HashSet.createContext<unknown>({
  hasher: Hasher.anyDeepHasher(),
  eq: Eq.anyDeepEq(),
});

/**
 * The common hand-rolled pattern: key a Map by a value hash. There is no equality check
 * behind the hash, so a collision silently drops a distinct value.
 */
function hashKeyed(hash: (value: unknown) => string | number) {
  return (items: unknown[]): number => {
    const seen = new Map<string | number, unknown>();
    for (const item of items) {
      const key = hash(item);
      if (!seen.has(key)) seen.set(key, item);
    }
    return seen.size;
  };
}

export const adapters: Adapter[] = [
  { name: "unique-set MapSet", run: (items) => new MapSet(items).size },
  { name: "deep-equality-data-structures DeepSet", run: (items) => new DeepSet(items).size },
  { name: "immutable Set(fromJS)", run: (items) => ImmutableSet(items.map((item) => fromJS(item))).size },
  { name: "@rimbu/hashed HashSet (deep)", run: (items) => rimbuDeep.from(items).size },
  { name: "ohash + Map", run: hashKeyed(ohash) },
  { name: "hash-it + Map", run: hashKeyed(hashIt) },
  { name: "lodash uniqWith(isEqual)", run: (items) => uniqWith(items, isEqual).length, maxItems: 2_000 },
];
