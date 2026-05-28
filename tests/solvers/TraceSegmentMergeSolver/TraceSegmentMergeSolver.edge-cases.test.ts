import { expect, test } from "bun:test"
import {
  hasHorizontalSegmentAtY,
  hasVerticalSegmentAtX,
  makeTrace,
  solve,
  solveTracePathsByPairId,
  type SolvedTracePath,
} from "./TraceSegmentMergeSolver.helpers"

test("does not merge touching or barely-overlapping ranges", () => {
  const touching = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 1, y: 0.08 },
      { x: 2, y: 0.08 },
    ]),
  ]

  const barelyOverlapping = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 1.01, y: 0 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 1, y: 0.08 },
      { x: 2, y: 0.08 },
    ]),
  ]

  expect(solve(touching).map((trace) => trace.tracePath)).toEqual(
    touching.map((trace) => trace.tracePath),
  )
  expect(solve(barelyOverlapping).map((trace) => trace.tracePath)).toEqual(
    barelyOverlapping.map((trace) => trace.tracePath),
  )
})

test("does not merge segments past the distance threshold", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 1, y: 0.121 },
      { x: 3, y: 0.121 },
    ]),
  ]

  expect(solve(traces).map((trace) => trace.tracePath)).toEqual(
    traces.map((trace) => trace.tracePath),
  )
})

test("merges at inclusive distance and overlap thresholds", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 1.02, y: 0 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 1, y: 0.12 },
      { x: 2, y: 0.12 },
    ]),
  ]

  const [first, second] = solve(traces)

  expect(first!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: 0.06 },
    { x: 1.02, y: 0.06 },
    { x: 1.02, y: 0 },
  ])
  expect(second!.tracePath).toEqual([
    { x: 1, y: 0.12 },
    { x: 1, y: 0.06 },
    { x: 2, y: 0.06 },
    { x: 2, y: 0.12 },
  ])
})

test("uses the overlap threshold with epsilon-sized margins", () => {
  const belowThreshold = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 1.019999, y: 0 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 1, y: 0.08 },
      { x: 2, y: 0.08 },
    ]),
  ]
  const aboveThreshold = [
    makeTrace("E-F", "net-1", [
      { x: 0, y: 0 },
      { x: 1.020001, y: 0 },
    ]),
    makeTrace("G-H", "net-1", [
      { x: 1, y: 0.08 },
      { x: 2, y: 0.08 },
    ]),
  ]

  const [firstAbove, secondAbove] = solve(aboveThreshold)

  expect(solve(belowThreshold).map((trace) => trace.tracePath)).toEqual(
    belowThreshold.map((trace) => trace.tracePath),
  )
  expect(firstAbove!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: 0.04 },
    { x: 1.020001, y: 0.04 },
    { x: 1.020001, y: 0 },
  ])
  expect(secondAbove!.tracePath).toEqual([
    { x: 1, y: 0.08 },
    { x: 1, y: 0.04 },
    { x: 2, y: 0.04 },
    { x: 2, y: 0.08 },
  ])
})

test("does not merge segments from the same trace", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 0.08 },
      { x: 0, y: 0.08 },
    ]),
  ]

  expect(solve(traces)[0]!.tracePath).toEqual(traces[0]!.tracePath)
})

test("does not indirectly merge two segments from the same trace into one cluster", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 0.1 },
      { x: 0, y: 0.1 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 0, y: 0.05 },
      { x: 4, y: 0.05 },
    ]),
  ]

  const [first, second] = solve(traces)

  expect(first!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: 0.025 },
    { x: 4, y: 0.025 },
    { x: 4, y: 0.1 },
    { x: 0, y: 0.1 },
  ])
  expect(second!.tracePath).toEqual([
    { x: 0, y: 0.05 },
    { x: 0, y: 0.025 },
    { x: 4, y: 0.025 },
    { x: 4, y: 0.05 },
  ])
})

test("still merges a valid subcluster when a larger connected cluster has repeated trace ids", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 0.14 },
      { x: 0, y: 0.14 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 0, y: 0.04 },
      { x: 4, y: 0.04 },
    ]),
  ]

  const [first, second] = solve(traces)

  expect(first!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: 0.02 },
    { x: 4, y: 0.02 },
    { x: 4, y: 0.14 },
    { x: 0, y: 0.14 },
  ])
  expect(second!.tracePath).toEqual([
    { x: 0, y: 0.04 },
    { x: 0, y: 0.02 },
    { x: 4, y: 0.02 },
    { x: 4, y: 0.04 },
  ])
})

test("preserves terminal endpoints on first and last segments of multipoint traces", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 1 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 0, y: 1 },
      { x: 0, y: 0.08 },
      { x: 4, y: 0.08 },
    ]),
  ]

  const [first, second] = solve(traces)

  expect(first!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: 0.04 },
    { x: 4, y: 0.04 },
    { x: 4, y: 1 },
  ])
  expect(second!.tracePath).toEqual([
    { x: 0, y: 1 },
    { x: 0, y: 0.04 },
    { x: 4, y: 0.04 },
    { x: 4, y: 0.08 },
  ])
})

test("preserves both endpoints when first and last segments of one trace merge separately", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 2 },
      { x: 0, y: 2 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 1, y: 0.08 },
      { x: 2, y: 0.08 },
    ]),
    makeTrace("E-F", "net-1", [
      { x: 1, y: 2.08 },
      { x: 2, y: 2.08 },
    ]),
  ]

  const [mainTrace, firstMergeTrace, lastMergeTrace] = solve(traces)

  expect(mainTrace!.tracePath[0]).toEqual({ x: 0, y: 0 })
  expect(mainTrace!.tracePath[mainTrace!.tracePath.length - 1]).toEqual({
    x: 0,
    y: 2,
  })
  expect(hasHorizontalSegmentAtY(mainTrace!, 0.04, 0, 3)).toBe(true)
  expect(hasHorizontalSegmentAtY(mainTrace!, 2.04, 0, 3)).toBe(true)
  expect(hasHorizontalSegmentAtY(firstMergeTrace!, 0.04, 1, 2)).toBe(true)
  expect(hasHorizontalSegmentAtY(lastMergeTrace!, 2.04, 1, 2)).toBe(true)
})

test("merges traces with negative coordinates", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: -4, y: -1 },
      { x: 0, y: -1 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: -3, y: -0.92 },
      { x: -1, y: -0.92 },
    ]),
  ]

  const [first, second] = solve(traces)

  expect(first!.tracePath).toEqual([
    { x: -4, y: -1 },
    { x: -4, y: -0.96 },
    { x: 0, y: -0.96 },
    { x: 0, y: -1 },
  ])
  expect(second!.tracePath).toEqual([
    { x: -3, y: -0.92 },
    { x: -3, y: -0.96 },
    { x: -1, y: -0.96 },
    { x: -1, y: -0.92 },
  ])
})

test("merges vertical traces with negative coordinates", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: -1, y: -4 },
      { x: -1, y: 0 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: -0.92, y: -3 },
      { x: -0.92, y: -1 },
    ]),
  ]

  const [first, second] = solve(traces)

  expect(first!.tracePath).toEqual([
    { x: -1, y: -4 },
    { x: -0.96, y: -4 },
    { x: -0.96, y: 0 },
    { x: -1, y: 0 },
  ])
  expect(second!.tracePath).toEqual([
    { x: -0.92, y: -3 },
    { x: -0.96, y: -3 },
    { x: -0.96, y: -1 },
    { x: -0.92, y: -1 },
  ])
})

test("does not crash on zero-length segments and removes duplicate points", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 1, y: 0.08 },
      { x: 3, y: 0.08 },
    ]),
  ]

  const [zeroLengthTrace, otherTrace] = solve(traces)

  expect(zeroLengthTrace!.tracePath).toEqual([{ x: 0, y: 0 }])
  expect(otherTrace!.tracePath).toEqual(traces[1]!.tracePath)
})

test("removes duplicate internal points while merging a neighboring segment", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 1 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 1, y: 0.08 },
      { x: 3, y: 0.08 },
    ]),
  ]

  const [first, second] = solve(traces)

  expect(first!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: 0.04 },
    { x: 4, y: 0.04 },
    { x: 4, y: 1 },
  ])
  expect(second!.tracePath).toEqual([
    { x: 1, y: 0.08 },
    { x: 1, y: 0.04 },
    { x: 3, y: 0.04 },
    { x: 3, y: 0.08 },
  ])
})

test("simplifies collinear points created after a terminal merge", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 1 },
      { x: 4, y: 2 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 1, y: 0.08 },
      { x: 3, y: 0.08 },
    ]),
  ]

  const [first, second] = solve(traces)

  expect(first!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: 0.04 },
    { x: 4, y: 0.04 },
    { x: 4, y: 2 },
  ])
  expect(second!.tracePath).toEqual([
    { x: 1, y: 0.08 },
    { x: 1, y: 0.04 },
    { x: 3, y: 0.04 },
    { x: 3, y: 0.08 },
  ])
})

test("treats almost-horizontal and almost-vertical segments within EPS as orthogonal", () => {
  const almostHorizontal = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 4, y: 5e-7 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 1, y: 0.08 },
      { x: 3, y: 0.0800005 },
    ]),
  ]
  const almostVertical = [
    makeTrace("E-F", "net-2", [
      { x: 0, y: 0 },
      { x: 5e-7, y: 4 },
    ]),
    makeTrace("G-H", "net-2", [
      { x: 0.1, y: 1 },
      { x: 0.1000005, y: 3 },
    ]),
  ]

  const [firstHorizontal, secondHorizontal] = solve(almostHorizontal)
  const [firstVertical, secondVertical] = solve(almostVertical)

  expect(firstHorizontal!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: 0.04 },
    { x: 4, y: 0.04 },
    { x: 4, y: 5e-7 },
  ])
  expect(secondHorizontal!.tracePath).toEqual([
    { x: 1, y: 0.08 },
    { x: 1, y: 0.04 },
    { x: 3, y: 0.04 },
    { x: 3, y: 0.0800005 },
  ])
  expect(firstVertical!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 0.05, y: 0 },
    { x: 0.05, y: 4 },
    { x: 5e-7, y: 4 },
  ])
  expect(secondVertical!.tracePath).toEqual([
    { x: 0.1, y: 1 },
    { x: 0.05, y: 1 },
    { x: 0.05, y: 3 },
    { x: 0.1000005, y: 3 },
  ])
})

test("ignores almost-orthogonal segments just outside EPS", () => {
  const almostHorizontal = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 4, y: 0.0000011 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 1, y: 0.08 },
      { x: 3, y: 0.0800011 },
    ]),
  ]
  const almostVertical = [
    makeTrace("E-F", "net-2", [
      { x: 0, y: 0 },
      { x: 0.0000011, y: 4 },
    ]),
    makeTrace("G-H", "net-2", [
      { x: 0.1, y: 1 },
      { x: 0.1000011, y: 3 },
    ]),
  ]

  expect(solve(almostHorizontal).map((trace) => trace.tracePath)).toEqual(
    almostHorizontal.map((trace) => trace.tracePath),
  )
  expect(solve(almostVertical).map((trace) => trace.tracePath)).toEqual(
    almostVertical.map((trace) => trace.tracePath),
  )
})

test("ignores diagonal segments", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 4, y: 0.04 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 0, y: 0.08 },
      { x: 4, y: 0.08 },
    ]),
  ]

  expect(solve(traces).map((trace) => trace.tracePath)).toEqual(
    traces.map((trace) => trace.tracePath),
  )
})

test("preserves trace metadata", () => {
  const trace = {
    ...makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    dcConnNetId: "dc-net-1",
    userNetId: "USER_NET",
    pinIds: ["A", "B"],
    mspConnectionPairIds: ["A-B", "alias"],
  }
  const traces = [
    trace,
    makeTrace("C-D", "net-1", [
      { x: 1, y: 0.08 },
      { x: 3, y: 0.08 },
    ]),
  ]

  const [outputTrace] = solve(traces)

  expect(outputTrace!.mspPairId).toBe(trace.mspPairId)
  expect(outputTrace!.dcConnNetId).toBe(trace.dcConnNetId)
  expect(outputTrace!.globalConnNetId).toBe(trace.globalConnNetId)
  expect(outputTrace!.userNetId).toBe(trace.userNetId)
  expect(outputTrace!.pinIds).toEqual(trace.pinIds)
  expect(outputTrace!.mspConnectionPairIds).toEqual(trace.mspConnectionPairIds)
})

test("does not merge traces that reuse the same mspPairId", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    makeTrace("A-B", "net-1", [
      { x: 1, y: 0.08 },
      { x: 3, y: 0.08 },
    ]),
  ]

  expect(solve(traces).map((trace) => trace.tracePath)).toEqual(
    traces.map((trace) => trace.tracePath),
  )
})

test("merges traces with large coordinates and small offsets", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 1_000_000, y: 1_000_000 },
      { x: 1_000_004, y: 1_000_000 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 1_000_001, y: 1_000_000.08 },
      { x: 1_000_003, y: 1_000_000.08 },
    ]),
  ]

  const [first, second] = solve(traces)

  expect(
    hasHorizontalSegmentAtY(first!, 1_000_000.04, 1_000_000, 1_000_004),
  ).toBe(true)
  expect(
    hasHorizontalSegmentAtY(second!, 1_000_000.04, 1_000_001, 1_000_003),
  ).toBe(true)
})

test("is idempotent", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 1, y: 0.08 },
      { x: 3, y: 0.08 },
    ]),
    makeTrace("E-F", "net-2", [
      { x: 4, y: 0 },
      { x: 4.08, y: 0 },
      { x: 4.08, y: 3 },
    ]),
    makeTrace("G-H", "net-2", [
      { x: 4, y: 1 },
      { x: 4, y: 2 },
    ]),
  ]

  const firstPass = solve(traces)
  const secondPass = solve(firstPass)

  expect(secondPass).toEqual(firstPass)
})

test("does not mutate input traces", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 1, y: 0.08 },
      { x: 3, y: 0.08 },
    ]),
  ]
  const original = structuredClone(traces)

  solve(traces)

  expect(traces).toEqual(original)
})

test("solves a small parallel-trace batch without excessive runtime", () => {
  const traces: SolvedTracePath[] = []
  for (let index = 0; index < 50; index++) {
    const y = index * 0.4
    traces.push(
      makeTrace(`A${index}-B${index}`, `net-${index}`, [
        { x: 0, y },
        { x: 4, y },
      ]),
      makeTrace(`C${index}-D${index}`, `net-${index}`, [
        { x: 1, y: y + 0.08 },
        { x: 3, y: y + 0.08 },
      ]),
    )
  }

  const startedAt = performance.now()
  const output = solve(traces)
  const elapsedMs = performance.now() - startedAt

  expect(output).toHaveLength(traces.length)
  expect(elapsedMs).toBeLessThan(1000)
})

test("moves internal segments without adding terminal jogs", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 0 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 1, y: 1.08 },
      { x: 3, y: 1.08 },
    ]),
  ]

  const [first, second] = solve(traces)

  expect(first!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: 1.04 },
    { x: 4, y: 1.04 },
    { x: 4, y: 0 },
  ])
  expect(second!.tracePath).toEqual([
    { x: 1, y: 1.08 },
    { x: 1, y: 1.04 },
    { x: 3, y: 1.04 },
    { x: 3, y: 1.08 },
  ])
})
