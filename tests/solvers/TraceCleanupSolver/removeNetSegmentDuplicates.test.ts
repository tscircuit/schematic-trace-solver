import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"
import overlapFixture from "../../assets/OverlapAvoidanceStepSolver.test.input.json"
import { removeDuplicateConsecutivePoints } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import { removeNetSegmentDuplicates } from "lib/solvers/TraceCleanupSolver/removeNetSegmentDuplicates"

const EPS = 1e-9

const segmentKey = (
  a: { x: number; y: number },
  b: { x: number; y: number },
) => {
  const p1 = `${a.x},${a.y}`
  const p2 = `${b.x},${b.y}`
  return p1 < p2 ? `${p1}|${p2}` : `${p2}|${p1}`
}

test("removeDuplicateConsecutivePoints removes zero-length segments from a single path", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 0 }, // duplicate
    { x: 2, y: 0 },
    { x: 2, y: 0 }, // duplicate
    { x: 2, y: 1 },
  ]
  const result = removeDuplicateConsecutivePoints(path)
  expect(result).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
  ])
})

test("removeNetSegmentDuplicates removes cross-trace duplicate segments within same net", () => {
  const traceA = {
    mspPairId: "A-B",
    dcConnNetId: "net1",
    globalConnNetId: "net1",
    pins: [] as any,
    pinIds: ["A", "B"],
    mspConnectionPairIds: ["A-B"],
    tracePath: [
      { x: 0, y: 0 }, // pin A
      { x: -1, y: 0 }, // shared segment
      { x: -1, y: -1 },
      { x: 0, y: -1 }, // pin B
    ],
  }

  const traceB = {
    mspPairId: "A-C",
    dcConnNetId: "net1",
    globalConnNetId: "net1",
    pins: [] as any,
    pinIds: ["A", "C"],
    mspConnectionPairIds: ["A-C"],
    tracePath: [
      { x: 1, y: 0 }, // pin C
      { x: 0, y: 0 }, // pin A  (connected to traceA start)
      { x: -1, y: 0 }, // same segment as traceA[0->1]
    ],
  }

  const result = removeNetSegmentDuplicates([traceA, traceB])

  // Collect all segments across result traces
  const allSegmentKeys = new Set<string>()
  let duplicateFound = false

  for (const trace of result) {
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      const key = `${trace.globalConnNetId}|${segmentKey(trace.tracePath[i], trace.tracePath[i + 1])}`
      if (allSegmentKeys.has(key)) {
        duplicateFound = true
      }
      allSegmentKeys.add(key)
    }
  }

  expect(duplicateFound).toBe(false)
})

test("fix issue #78: no duplicate segments in pipeline output for OverlapAvoidance fixture", () => {
  const inputProblem = structuredClone((overlapFixture as any).problem)

  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  // Get traces after TraceCleanupSolver (which now deduplicates)
  const traces =
    (solver as any).traceCleanupSolver?.getOutput().traces ??
    (solver as any).traceLabelOverlapAvoidanceSolver?.getOutput().traces ??
    []

  // Count cross-trace segment occurrences per net
  const netSegCounts = new Map<string, number>()
  for (const trace of traces as any[]) {
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      const key = `${trace.globalConnNetId}|${segmentKey(trace.tracePath[i], trace.tracePath[i + 1])}`
      netSegCounts.set(key, (netSegCounts.get(key) ?? 0) + 1)
    }
  }

  const duplicates = [...netSegCounts.entries()].filter(([_, c]) => c > 1)
  expect(duplicates.length).toBe(0)
})

test("fix issue #78: simplifyPath removes consecutive duplicate points produced by path concatenation", () => {
  // Simulate what UntangleTraceSubsolver does when concatenating path segments:
  // slice(0, p2Index) + bestRoute + slice(p2Index+1) can produce duplicate points
  // at the junctions when bestRoute starts/ends at the same point as slice boundaries
  const prefix = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 }, // p2 to be replaced
  ]
  const bestRoute = [
    { x: 1, y: 1 }, // same as prefix end — duplicate!
    { x: 2, y: 1 },
    { x: 2, y: 2 },
    { x: 3, y: 2 }, // same as suffix start — duplicate!
  ]
  const suffix = [
    { x: 3, y: 2 }, // slice(p2Index+1) start
    { x: 4, y: 2 },
  ]

  const concatenated = [...prefix.slice(0, 2), ...bestRoute, ...suffix]
  // Contains duplicates at junctions
  const duplicatesBefore = concatenated.filter(
    (p, i) =>
      i > 0 &&
      Math.abs(p.x - concatenated[i - 1].x) < EPS &&
      Math.abs(p.y - concatenated[i - 1].y) < EPS,
  )
  expect(duplicatesBefore.length).toBeGreaterThan(0)

  const cleaned = removeDuplicateConsecutivePoints(concatenated)
  const duplicatesAfter = cleaned.filter(
    (p, i) =>
      i > 0 &&
      Math.abs(p.x - cleaned[i - 1].x) < EPS &&
      Math.abs(p.y - cleaned[i - 1].y) < EPS,
  )
  expect(duplicatesAfter.length).toBe(0)
})
