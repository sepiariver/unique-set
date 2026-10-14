/*
 * Data shapes ported from hash-it's comparison benchmark:
 * https://github.com/planttheidea/hash-it/blob/fb79133/benchmarks/compare.js
 *
 * hash-it is MIT licensed, Copyright (c) 2025 Tony Quetano.
 * The upstream benchmark fills these records with @faker-js/faker; this port uses a seeded
 * PRNG over small word lists instead, so runs are reproducible without a faker dependency.
 */
import { createRng, pick } from "../competitors/workload";

const FIRST_NAMES = ["Ada", "Grace", "Linus", "Margaret", "Alan", "Barbara", "Ken", "Radia", "Dennis", "Frances"];
const CITIES = ["Lisbon", "Osaka", "Nairobi", "Toronto", "Oslo", "Lima", "Hanoi", "Perth", "Tunis", "Quito"];
const STREETS = ["Maple", "Harbor", "Cedar", "Mill", "Station", "Willow", "Bridge", "Orchard"];
const COUNTRIES = ["Portugal", "Japan", "Kenya", "Canada", "Norway", "Peru", "Vietnam", "Australia"];
const DOMAINS = ["example.com", "example.org", "example.net"];
const WORDS = ["alpha", "bravo", "cedar", "delta", "ember", "fjord", "gamma", "harbor", "indigo", "juniper"];

function alphaNumeric(rng: () => number): string {
  return Math.floor(rng() * 36).toString(36);
}

/** One record per index, shaped like compare.js's `dataArray` entries; `randoms[0]` keeps each distinct. */
export function hashItRecords(count: number, seed: number): Record<string, unknown>[] {
  const rng = createRng(seed);
  const records: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    records.push({
      name: pick(rng, FIRST_NAMES),
      date: new Date(Date.UTC(2020, 0, 1) + i * 60_000),
      address: {
        city: pick(rng, CITIES),
        streetAddress: `${Math.floor(rng() * 9999)} ${pick(rng, STREETS)} St`,
        country: pick(rng, COUNTRIES),
      },
      email: Array.from({ length: 4 }, () => `${pick(rng, WORDS)}${Math.floor(rng() * 1000)}@${pick(rng, DOMAINS)}`),
      randoms: [
        i,
        alphaNumeric(rng),
        Math.floor(rng() * 100_000),
        alphaNumeric(rng),
        `${pick(rng, WORDS)} ${pick(rng, WORDS)} ${pick(rng, WORDS)}`,
        pick(rng, WORDS),
      ],
      avatars: Array.from({ length: 4 }, () => {
        const n = Math.floor(rng() * 100_000);
        return { number: n, avatar: `https://avatars.example.com/${n}.jpg` };
      }),
    });
  }
  return records;
}

/** compare.js's `dataStairs`: a 100-level `{ data: … }` chain, with a distinct leaf per index. */
export function hashItStairs(count: number, depth = 100): Record<string, unknown>[] {
  const stairs: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    let node: Record<string, unknown> = { end: `is near ${i}` };
    for (let d = 0; d < depth; d++) node = { data: node };
    stairs.push(node);
  }
  return stairs;
}
