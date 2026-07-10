import { expect, test } from "bun:test"
import { mergeNearbySameNetSegments } from "lib/solvers/TraceCleanupSolver/mergeNearbySameNetSegments"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

/** Helper that creates minimal SolvedTracePath objects for testing. */
const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [] as any,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    tracePath,
  }) as any

// ─── Horizontal merging ────────────────────────────────────────────────────────

test("mergeNearbySameNetSegments: aligns close overlapping horizontal same-net segments", () => {
  const [a, b] = mergeNearbySameNetSegments([
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
    ]),
    makeTrace("b", "net1", [
      { x: 1, y: 0 },
      { x: 1, y: 1.1 },
      { x: 4, y: 1.1 },
      { x: 4, y: 2 },
    ]),
  ])

  // Both horizontal segments should be snapped to the average Y = 1.05
  expect(a!.tracePath[1]!.y).toBeCloseTo(1.05)
  expect(a!.tracePath[2]!.y).toBeCloseTo(1.05)
  expect(b!.tracePath[1]!.y).toBeCloseTo(1.05)
  expect(b!.tracePath[2]!.y).toBeCloseTo(1.05)
})

test("mergeNearbySameNetSegments: merges all same-net segments in a 3-trace group", () => {
  const [a, b, c] = mergeNearbySameNetSegments([
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
    ]),
    makeTrace("b", "net1", [
      { x: 1, y: 0 },
      { x: 1, y: 1.1 },
      { x: 4, y: 1.1 },
      { x: 4, y: 2 },
    ]),
    makeTrace("c", "net1", [
      { x: 2, y: 0 },
      { x: 2, y: 1.2 },
      { x: 5, y: 1.2 },
      { x: 5, y: 2 },
    ]),
  ])

  const avg = (1 + 1.1 + 1.2) / 3 // ≈ 1.1
  expect(a!.tracePath[1]!.y).toBeCloseTo(avg)
  expect(b!.tracePath[1]!.y).toBeCloseTo(avg)
  expect(c!.tracePath[1]!.y).toBeCloseTo(avg)
})

// ─── Vertical merging ─────────────────────────────────────────────────────────

test("mergeNearbySameNetSegments: aligns close overlapping vertical same-net segments", () => {
  const [a, b] = mergeNearbySameNetSegments([
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 3 },
      { x: 2, y: 3 },
    ]),
    makeTrace("b", "net1", [
      { x: 0, y: 1 },
      { x: 1.1, y: 1 },
      { x: 1.1, y: 4 },
      { x: 2, y: 4 },
    ]),
  ])

  expect(a!.tracePath[1]!.x).toBeCloseTo(1.05)
  expect(a!.tracePath[2]!.x).toBeCloseTo(1.05)
  expect(b!.tracePath[1]!.x).toBeCloseTo(1.05)
  expect(b!.tracePath[2]!.x).toBeCloseTo(1.05)
})

// ─── Different-net isolation ──────────────────────────────────────────────────

test("mergeNearbySameNetSegments: does NOT align different-net segments", () => {
  const [a, b] = mergeNearbySameNetSegments([
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
    ]),
    makeTrace("b", "net2", [
      { x: 1, y: 0 },
      { x: 1, y: 1.1 },
      { x: 4, y: 1.1 },
      { x: 4, y: 2 },
    ]),
  ])

  // Neither trace should be modified
  expect(a!.tracePath[1]!.y).toBe(1)
  expect(b!.tracePath[1]!.y).toBe(1.1)
})

// ─── Distance threshold ───────────────────────────────────────────────────────

test("mergeNearbySameNetSegments: does NOT merge segments farther than mergeDistance", () => {
  const [a, b] = mergeNearbySameNetSegments(
    [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 2 },
      ]),
      makeTrace("b", "net1", [
        { x: 1, y: 0 },
        { x: 1, y: 5 }, // Far apart – distance = 4 >> 0.18 default
        { x: 4, y: 5 },
        { x: 4, y: 6 },
      ]),
    ],
    0.18,
  )

  expect(a!.tracePath[1]!.y).toBe(1)
  expect(b!.tracePath[1]!.y).toBe(5)
})

// ─── Non-overlapping ranges ───────────────────────────────────────────────────

test("mergeNearbySameNetSegments: does NOT merge close-but-non-overlapping segments", () => {
  // Trace a: horizontal segment from x=0 to x=1 at y=1
  // Trace b: horizontal segment from x=2 to x=3 at y=1.05 (same net, close Y, but ranges don't overlap)
  const [a, b] = mergeNearbySameNetSegments([
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ]),
    makeTrace("b", "net1", [
      { x: 2, y: 0 },
      { x: 2, y: 1.05 },
      { x: 3, y: 1.05 },
      { x: 3, y: 2 },
    ]),
  ])

  expect(a!.tracePath[1]!.y).toBe(1)
  expect(b!.tracePath[1]!.y).toBe(1.05)
})

// ─── Endpoint preservation ────────────────────────────────────────────────────

test("mergeNearbySameNetSegments: preserves start/end pin coordinates", () => {
  // Both traces only have 2 points (a single segment = endpoint segment) – must not be moved
  const [a, b] = mergeNearbySameNetSegments([
    makeTrace("a", "net1", [
      { x: 0, y: 1 },
      { x: 3, y: 1 },
    ]),
    makeTrace("b", "net1", [
      { x: 0, y: 1.05 },
      { x: 3, y: 1.05 },
    ]),
  ])

  expect(a!.tracePath[0]!.y).toBe(1)
  expect(b!.tracePath[0]!.y).toBe(1.05)
})
