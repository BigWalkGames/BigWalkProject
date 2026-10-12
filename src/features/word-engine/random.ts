/**
 * Seeded randomness. The engine never calls Math.random directly, so a seed
 * makes a word bank reproducible (tests, debugging, sharing a bank).
 *
 * Kept bit-identical to the Python reference (word-engine-claude/engine.py):
 * same generator, and sampling uses only + and * (no pow/log, which can
 * differ in the last bit between languages).
 */

export type Rng = () => number

/** mulberry32: tiny, fast, good-enough 32-bit generator. Returns [0, 1). */
export function createRng(seed?: number): Rng {
  let a = (seed ?? Math.floor(Math.random() * 2 ** 32)) | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fisher-Yates, in place. */
export function shuffle<T>(items: T[], rng: Rng): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = items[i]
    items[i] = items[j]
    items[j] = tmp
  }
}

/** Pick k items without replacement, chance proportional to weight. */
export function weightedSample<T>(
  items: readonly T[],
  weights: readonly number[],
  k: number,
  rng: Rng,
): T[] {
  const pool: { item: T; weight: number }[] = []
  items.forEach((item, i) => {
    if (weights[i] > 0) pool.push({ item, weight: weights[i] })
  })

  const out: T[] = []
  while (out.length < k && pool.length > 0) {
    let total = 0
    for (const entry of pool) total += entry.weight
    const r = rng() * total

    let index = pool.length - 1
    let acc = 0
    for (let i = 0; i < pool.length; i += 1) {
      acc += pool[i].weight
      if (r < acc) {
        index = i
        break
      }
    }
    out.push(pool.splice(index, 1)[0].item)
  }
  return out
}
