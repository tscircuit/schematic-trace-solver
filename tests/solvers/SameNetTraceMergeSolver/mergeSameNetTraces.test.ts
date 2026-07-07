import { test, expect } from "bun:test"
import { mergeSameNetTraces } from "lib/solvers/SameNetTraceMergeSolver/mergeSameNetTraces"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  id: string,
  net: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId: id,
    dcConnNetId: net,
    globalConnNetId: net,
    mspConnectionPairIds: [id],
    pinIds: [],
    pins: [],
    tracePath,
  }) as any

test("snaps two close same-net horizontal segments onto a shared Y", () => {
  const traces = [
    makeTrace("A", "NET1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    makeTrace("B", "NET1", [
      { x: 1, y: 0.2 },
      { x: 3, y: 0.2 },
    ]),
  ]

  const [a, b] = mergeSameNetTraces(traces, { mergeDistanceThreshold: 0.5 })

  // The shorter segment (B) snaps onto the dominant longer segment (A) at y=0.
  expect(a!.tracePath.every((p) => p.y === 0)).toBe(true)
  expect(b!.tracePath.every((p) => p.y === 0)).toBe(true)
})

test("snaps two close same-net vertical segments onto a shared X", () => {
  const traces = [
    makeTrace("A", "NET1", [
      { x: 0, y: 0 },
      { x: 0, y: 4 },
    ]),
    makeTrace("B", "NET1", [
      { x: 0.3, y: 1 },
      { x: 0.3, y: 3 },
    ]),
  ]

  const [a, b] = mergeSameNetTraces(traces, { mergeDistanceThreshold: 0.5 })

  expect(a!.tracePath.every((p) => p.x === 0)).toBe(true)
  expect(b!.tracePath.every((p) => p.x === 0)).toBe(true)
})

test("does NOT merge segments belonging to different nets", () => {
  const traces = [
    makeTrace("A", "NET1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    makeTrace("B", "NET2", [
      { x: 1, y: 0.2 },
      { x: 3, y: 0.2 },
    ]),
  ]

  const [, b] = mergeSameNetTraces(traces, { mergeDistanceThreshold: 0.5 })

  // Different net — must stay where it was.
  expect(b!.tracePath.every((p) => p.y === 0.2)).toBe(true)
})

test("does NOT merge same-net segments that are farther apart than the threshold", () => {
  const traces = [
    makeTrace("A", "NET1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    makeTrace("B", "NET1", [
      { x: 1, y: 1.5 },
      { x: 3, y: 1.5 },
    ]),
  ]

  const [, b] = mergeSameNetTraces(traces, { mergeDistanceThreshold: 0.5 })

  expect(b!.tracePath.every((p) => p.y === 1.5)).toBe(true)
})

test("does NOT merge close parallel same-net segments that do not overlap along their axis", () => {
  const traces = [
    makeTrace("A", "NET1", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]),
    makeTrace("B", "NET1", [
      { x: 5, y: 0.2 },
      { x: 7, y: 0.2 },
    ]),
  ]

  const [, b] = mergeSameNetTraces(traces, { mergeDistanceThreshold: 0.5 })

  expect(b!.tracePath.every((p) => p.y === 0.2)).toBe(true)
})

test("does not mutate the input traces", () => {
  const traces = [
    makeTrace("A", "NET1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    makeTrace("B", "NET1", [
      { x: 1, y: 0.2 },
      { x: 3, y: 0.2 },
    ]),
  ]

  mergeSameNetTraces(traces, { mergeDistanceThreshold: 0.5 })

  expect(traces[1]!.tracePath[0]!.y).toBe(0.2)
})

test("preserves the endpoints of an L-shaped trace while snapping its long leg", () => {
  // A: long horizontal leg at y=0 from x=0..4, then up to (4,2)
  // B: short same-net horizontal stub near y=0.2 overlapping A's leg
  const traces = [
    makeTrace("A", "NET1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
    ]),
    makeTrace("B", "NET1", [
      { x: 1, y: 0.2 },
      { x: 3, y: 0.2 },
    ]),
  ]

  const [a, b] = mergeSameNetTraces(traces, { mergeDistanceThreshold: 0.5 })

  // B snapped onto y=0
  expect(b!.tracePath.every((p) => p.y === 0)).toBe(true)
  // A's corner endpoint is untouched
  const last = a!.tracePath[a!.tracePath.length - 1]!
  expect(last).toEqual({ x: 4, y: 2 })
})

test("does not merge when the threshold is non-finite (NaN/Infinity)", () => {
  const make = () => [
    makeTrace("A", "NET1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    makeTrace("B", "NET1", [
      { x: 1, y: 0.2 },
      { x: 3, y: 0.2 },
    ]),
  ]
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
    const [, b] = mergeSameNetTraces(make(), { mergeDistanceThreshold: bad })
    expect(b!.tracePath.every((p) => p.y === 0.2)).toBe(true)
  }
})

test("ignores segments with non-finite coordinates without throwing", () => {
  const traces = [
    makeTrace("A", "NET1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    makeTrace("BAD", "NET1", [
      { x: Number.NaN, y: 0.1 },
      { x: 3, y: Number.POSITIVE_INFINITY },
    ]),
  ]
  expect(() =>
    mergeSameNetTraces(traces, { mergeDistanceThreshold: 0.5 }),
  ).not.toThrow()
  const [a] = mergeSameNetTraces(traces, { mergeDistanceThreshold: 0.5 })
  // The valid trace is preserved.
  expect(a!.tracePath[0]).toEqual({ x: 0, y: 0 })
})
