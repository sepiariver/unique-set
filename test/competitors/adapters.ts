// One adapter per library: deduplicate `items` by value and return the resulting size, and
// optionally build a collection to answer value-equality lookups.
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
  /** Build a collection from `stored` (untimed) and return its lookup (timed). */
  has: (stored: unknown[]) => (query: unknown) => boolean;
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
function hashKeyed(hash: (value: unknown) => string | number): Pick<Adapter, "run" | "has"> {
  return {
    run: (items) => {
      const seen = new Map<string | number, unknown>();
      for (const item of items) {
        const key = hash(item);
        if (!seen.has(key)) seen.set(key, item);
      }
      return seen.size;
    },
    has: (stored) => {
      const seen = new Map(stored.map((item) => [hash(item), item]));
      return (query) => seen.has(hash(query));
    },
  };
}

export const adapters: Adapter[] = [
  {
    name: "unique-set MapSet",
    run: (items) => new MapSet(items).size,
    has: (stored) => {
      const set = new MapSet(stored);
      return (query) => set.has(query);
    },
  },
  {
    name: "deep-equality-data-structures DeepSet",
    run: (items) => new DeepSet(items).size,
    has: (stored) => {
      const set = new DeepSet(stored);
      return (query) => set.has(query);
    },
  },
  {
    name: "immutable Set(fromJS)",
    run: (items) => ImmutableSet(items.map((item) => fromJS(item))).size,
    // Converting the query is part of every lookup a caller would make.
    has: (stored) => {
      const set = ImmutableSet(stored.map((item) => fromJS(item)));
      return (query) => set.has(fromJS(query));
    },
  },
  {
    name: "@rimbu/hashed HashSet (deep)",
    run: (items) => rimbuDeep.from(items).size,
    has: (stored) => {
      const set = rimbuDeep.from(stored);
      return (query) => set.has(query);
    },
  },
  { name: "ohash + Map", ...hashKeyed(ohash) },
  { name: "hash-it + Map", ...hashKeyed(hashIt) },
  {
    name: "lodash uniqWith(isEqual)",
    run: (items) => uniqWith(items, isEqual).length,
    has: (stored) => (query) => stored.some((item) => isEqual(item, query)),
    maxItems: 2_000,
  },
];
