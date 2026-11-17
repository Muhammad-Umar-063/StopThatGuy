/**
 * Seeded pseudo-random numbers with explicit, copyable state: sfc32 (Chris Doty-Humphrey's Small Fast
 * Counting generator), with its four words derived from the seed by a splitmix32-style mixer and
 * 12 warm-up outputs discarded. Not cryptographic.
 *
 * Only 32-bit integer operations are used (Math.imul, shifts, `>>> 0`), which ECMAScript specifies
 * exactly, so a seed yields the same sequence in every conforming JavaScript engine. Rules must draw
 * randomness only from the RngState held in the simulation state.
 */
export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

const GOLDEN_GAMMA = 0x9e3779b9;
const TWO_POW_32 = 0x1_0000_0000;
const WARM_UP_OUTPUTS = 12;

export function createRng(seed: number): RngState {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) throw new RangeError("seed must be a uint32");
  let s = seed;
  const nextWord = () => {
    s = (s + GOLDEN_GAMMA) >>> 0;
    return mix32(s);
  };
  const rng: RngState = { a: nextWord(), b: nextWord(), c: nextWord(), d: nextWord() };
  for (let i = 0; i < WARM_UP_OUTPUTS; i++) nextUint32(rng);
  return rng;
}

/** Uniform uint32. Advances `rng`. */
export function nextUint32(rng: RngState): number {
  const t = (rng.a + rng.b + rng.d) >>> 0;
  rng.d = (rng.d + 1) >>> 0;
  rng.a = (rng.b ^ (rng.b >>> 9)) >>> 0;
  rng.b = (rng.c + (rng.c << 3)) >>> 0;
  const rotated = ((rng.c << 21) | (rng.c >>> 11)) >>> 0;
  rng.c = (rotated + t) >>> 0;
  return t;
}

/** Uniform float in [0, 1) with 32 random bits. Advances `rng`. */
export function nextFloat(rng: RngState): number {
  return nextUint32(rng) / TWO_POW_32;
}

/** Unbiased integer in [0, maxExclusive) by rejection sampling. Advances `rng`. */
export function nextInt(rng: RngState, maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > TWO_POW_32) {
    throw new RangeError("maxExclusive must be an integer in 1..2^32");
  }
  const limit = TWO_POW_32 - (TWO_POW_32 % maxExclusive);
  let value = nextUint32(rng);
  while (value >= limit) value = nextUint32(rng);
  return value % maxExclusive;
}

export function cloneRng(rng: RngState): RngState {
  return { a: rng.a, b: rng.b, c: rng.c, d: rng.d };
}

function mix32(x: number): number {
  let z = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
  return (z ^ (z >>> 15)) >>> 0;
}
