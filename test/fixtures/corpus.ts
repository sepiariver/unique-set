// Named values ported from serializers' and the web platform's round-trip test suites, used by
// corpus.spec.ts (correctness) and competitors.bench.ts (timing). Provenance and licences are in
// each source file's header.
import { devalueCorpus } from "./devalue";
import { superjsonCorpus } from "./superjson";
import { wptCorpus } from "./wpt";

export interface CorpusEntry {
  /** The upstream test's name, prefixed with its source. */
  name: string;
  /**
   * Builds a fresh value. Two calls build values that are equal under unique-set semantics,
   * unless `copies` says otherwise.
   */
  make: () => unknown;
  /** Set when two `make()` calls build distinct values, with the reason. */
  copies?: { distinct: string };
  /** Set when `structuredClone` of the value is not an equal copy, with the reason. */
  clone?: { distinct: string } | { throws: string };
  /** The value contains itself, so comparing it takes unique-set's circular path. */
  circular?: true;
}

export const corpus: CorpusEntry[] = [...wptCorpus, ...devalueCorpus, ...superjsonCorpus];

/**
 * The entries a timed workload can repeat: acyclic, equal to their own structured
 * clone, and small. devalue's very sparse array alone would outweigh every other entry.
 */
export const benchableCorpus = corpus.filter((entry) => {
  if (entry.circular || entry.copies || entry.clone) return false;
  const value = entry.make();
  return !(Array.isArray(value) && value.length > 1_000);
});

/**
 * `rounds` records per benchable entry, `{ round, entry, value }`, so every record is distinct
 * by construction whatever the values compare as.
 */
export function corpusRecords(rounds: number): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  for (let round = 0; round < rounds; round++) {
    benchableCorpus.forEach((entry, index) => records.push({ round, entry: index, value: entry.make() }));
  }
  return records;
}
