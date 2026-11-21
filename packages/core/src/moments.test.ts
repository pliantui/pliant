import { describe, expect, it } from "vitest"

import { createMoments, mergeMoments, type Moments } from "./moments"

const mutating = process.env["PLIANT_MUTATION"] === "1"

function random(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function momentsOf(values: ArrayLike<number>, from = 0, to = values.length) {
  const moments = createMoments()
  for (let index = from; index < to; index++) {
    moments.add(values[index] ?? 0)
  }
  return moments.moments()
}

/**
 * The exact mean and sum of squared deviations of integers, which every
 * test value here is, scaled by a power of two.
 */
function exactOf(values: Float64Array, scale: number) {
  let sum = 0n
  let squares = 0n
  for (const x of values) {
    const integer = BigInt(x / scale)
    sum += integer
    squares += integer * integer
  }
  const n = BigInt(values.length)
  const mean = (Number(sum) / values.length) * scale
  const m2 = (Number(n * squares - sum * sum) / values.length) * scale * scale
  let largest = 0
  let deviation = 0
  for (const x of values) {
    largest = Math.max(largest, Math.abs(x))
    deviation = Math.max(deviation, Math.abs(x - mean))
  }
  return { mean, m2, M: largest, D: deviation }
}

// The catalog's allowances: 1e-9 × M for a mean, and
// V = 1e-9 × M × (D + 1e-9 × M) for a variance.
function expectMatches(merged: Moments, values: Float64Array, scale: number) {
  const { mean, m2, M, D } = exactOf(values, scale)
  expect(merged.count).toBe(values.length)
  expect(Math.abs(merged.mean - mean)).toBeLessThanOrEqual(1e-9 * M)
  const V = 1e-9 * M * (D + 1e-9 * M)
  expect(
    Math.abs(merged.m2 / merged.count - m2 / values.length)
  ).toBeLessThanOrEqual(V)
}

const datasets: [string, number, (r: () => number, index: number) => number][] =
  [
    // Values are integers times the scale, so the reference is exact.
    [
      "a large offset with a tiny variance",
      2 ** -20,
      (r) => 2 ** 30 + Math.floor(r() * 1024) * 2 ** -20,
    ],
    [
      "a huge offset with integer steps",
      1,
      (r) => 2 ** 52 + Math.floor(r() * 8),
    ],
    [
      "values of either sign and many magnitudes",
      2 ** -30,
      (r) => (r() < 0.5 ? -1 : 1) * Math.floor(2 ** (r() * 60)) * 2 ** -30,
    ],
    // Parts of sorted values have far apart means.
    ["a steady rise", 2 ** -10, (_, index) => 2 ** 30 + index * 2 ** -10],
  ]

describe("mergeMoments", () => {
  // Far above the local run time, so a loaded runner doesn't time out.
  const timeout = 30_000
  const length = mutating ? 2000 : 200_000

  it.each(datasets)(
    "merges any partition into the moments of all values: %s",
    (_, scale, generate) => {
      const next = random(11)
      const values = Float64Array.from({ length }, (_, index) =>
        generate(next, index)
      )
      for (let trial = 0; trial < 20; trial++) {
        // Cuts at random places, some next to each other, so parts of
        // every size, empty ones included, are merged in random order.
        const cuts = Array.from({ length: 1 + Math.floor(next() * 40) }, () =>
          Math.floor(next() * (length + 1))
        ).sort((a, b) => a - b)
        const bounds = [0, ...cuts, length]
        let parts = bounds
          .slice(1)
          .map((to, index) => momentsOf(values, bounds[index], to))
        while (parts.length > 1) {
          const index = Math.floor(next() * (parts.length - 1))
          const a = parts[index]
          const b = parts[index + 1]
          if (!a || !b) {
            throw new Error("No parts to merge")
          }
          const merged = next() < 0.5 ? mergeMoments(a, b) : mergeMoments(b, a)
          parts = [...parts.slice(0, index), merged, ...parts.slice(index + 2)]
        }
        expectMatches(parts[0] ?? momentsOf([]), values, scale)
      }
    },
    timeout
  )

  it(
    "merges a single value into a million",
    () => {
      const next = random(3)
      const values = Float64Array.from(
        { length: mutating ? 10_000 : 1_000_000 },
        () => 2 ** 30 + Math.floor(next() * 1024) * 2 ** -20
      )
      const merged = mergeMoments(
        momentsOf(values, 0, values.length - 1),
        momentsOf(values, values.length - 1)
      )
      expectMatches(merged, values, 2 ** -20)
    },
    timeout
  )

  it("returns the other moments when one side is empty", () => {
    // Squaring the difference of these means would overflow.
    const some = momentsOf([1e200, 2e200])
    expect(mergeMoments(momentsOf([]), some)).toEqual(some)
    expect(mergeMoments(some, momentsOf([]))).toEqual(some)
  })
})
