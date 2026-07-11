import { test, expect } from "bun:test"
import { mergeSameNetCloseTraces } from "lib/solvers/TraceCleanupSolver/mergeSameNetCloseTraces"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

/** Minimal InputProblem with no chips (no obstacles) */
const emptyProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

/**
 * Helper to build a minimal SolvedTracePath for testing.
 * Traces need at least 4 points to have an internal (non-endpoint) segment.
 */
function makeTrace(
  id: string,
  netId: string,
  path: Array<{ x: number; y: number }>,
): SolvedTracePath {
  return {
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    pins: [
      { pinId: `${id}.p1`, x: path[0]!.x, y: path[0]!.y, chipId: "chip0" },
      {
        pinId: `${id}.p2`,
        x: path[path.length - 1]!.x,
        y: path[path.length - 1]!.y,
        chipId: "chip1",
      },
    ],
    tracePath: path,
    mspConnectionPairIds: [id],
    pinIds: [`${id}.p1`, `${id}.p2`],
  } as SolvedTracePath
}

test("horizontal merge - same net, close Y, overlapping X ranges", () => {
  const traceA = makeTrace("A", "net0", [
    { x: 0, y: 0 },
    { x: 0, y: 1.0 },
    { x: 3, y: 1.0 },
    { x: 3, y: 2 },
  ])
  const traceB = makeTrace("B", "net0", [
    { x: 0, y: 0.5 },
    { x: 0, y: 1.1 },
    { x: 3, y: 1.1 },
    { x: 3, y: 2.5 },
  ])

  const result = mergeSameNetCloseTraces([traceA, traceB], emptyProblem)

  const midY = 1.05
  expect(result[0]!.tracePath[1]!.y).toBeCloseTo(midY, 10)
  expect(result[0]!.tracePath[2]!.y).toBeCloseTo(midY, 10)
  expect(result[1]!.tracePath[1]!.y).toBeCloseTo(midY, 10)
  expect(result[1]!.tracePath[2]!.y).toBeCloseTo(midY, 10)
})

test("vertical merge - same net, close X, overlapping Y ranges", () => {
  const traceA = makeTrace("A", "net0", [
    { x: 0, y: 0 },
    { x: 2.0, y: 0 },
    { x: 2.0, y: 3 },
    { x: 4, y: 3 },
  ])
  const traceB = makeTrace("B", "net0", [
    { x: 0, y: 0.5 },
    { x: 2.1, y: 0.5 },
    { x: 2.1, y: 3 },
    { x: 4, y: 3.5 },
  ])

  const result = mergeSameNetCloseTraces([traceA, traceB], emptyProblem)

  const midX = 2.05
  expect(result[0]!.tracePath[1]!.x).toBeCloseTo(midX, 10)
  expect(result[0]!.tracePath[2]!.x).toBeCloseTo(midX, 10)
  expect(result[1]!.tracePath[1]!.x).toBeCloseTo(midX, 10)
  expect(result[1]!.tracePath[2]!.x).toBeCloseTo(midX, 10)
})

test("different net - no merge even if close and overlapping", () => {
  const traceA = makeTrace("A", "net0", [
    { x: 0, y: 0 },
    { x: 0, y: 1.0 },
    { x: 3, y: 1.0 },
    { x: 3, y: 2 },
  ])
  const traceB = makeTrace("B", "net1", [
    { x: 0, y: 0.5 },
    { x: 0, y: 1.1 },
    { x: 3, y: 1.1 },
    { x: 3, y: 2.5 },
  ])

  const result = mergeSameNetCloseTraces([traceA, traceB], emptyProblem)

  expect(result[0]!.tracePath[1]!.y).toBeCloseTo(1.0, 10)
  expect(result[1]!.tracePath[1]!.y).toBeCloseTo(1.1, 10)
})

test("over threshold - no merge when distance exceeds threshold", () => {
  const traceA = makeTrace("A", "net0", [
    { x: 0, y: 0 },
    { x: 0, y: 1.0 },
    { x: 3, y: 1.0 },
    { x: 3, y: 2 },
  ])
  const traceB = makeTrace("B", "net0", [
    { x: 0, y: 0.5 },
    { x: 0, y: 1.5 },
    { x: 3, y: 1.5 },
    { x: 3, y: 2.5 },
  ])

  const result = mergeSameNetCloseTraces([traceA, traceB], emptyProblem)

  expect(result[0]!.tracePath[1]!.y).toBeCloseTo(1.0, 10)
  expect(result[1]!.tracePath[1]!.y).toBeCloseTo(1.5, 10)
})

test("non-overlapping ranges - no merge when X intervals don't overlap", () => {
  const traceA = makeTrace("A", "net0", [
    { x: 0, y: 0 },
    { x: 0, y: 1.0 },
    { x: 2, y: 1.0 },
    { x: 2, y: 2 },
  ])
  const traceB = makeTrace("B", "net0", [
    { x: 5, y: 0.5 },
    { x: 5, y: 1.1 },
    { x: 8, y: 1.1 },
    { x: 8, y: 2.5 },
  ])

  const result = mergeSameNetCloseTraces([traceA, traceB], emptyProblem)

  expect(result[0]!.tracePath[1]!.y).toBeCloseTo(1.0, 10)
  expect(result[1]!.tracePath[1]!.y).toBeCloseTo(1.1, 10)
})

test("endpoint segments are skipped - 2-point traces have no internal segments", () => {
  const traceA = makeTrace("A", "net0", [
    { x: 0, y: 1.0 },
    { x: 3, y: 1.0 },
  ])
  const traceB = makeTrace("B", "net0", [
    { x: 0, y: 1.1 },
    { x: 3, y: 1.1 },
  ])

  const result = mergeSameNetCloseTraces([traceA, traceB], emptyProblem)

  expect(result[0]!.tracePath[0]!.y).toBeCloseTo(1.0, 10)
  expect(result[1]!.tracePath[0]!.y).toBeCloseTo(1.1, 10)
})

test("collision revert - merge reverted if it causes chip collision", () => {
  const problemWithChip: InputProblem = {
    chips: [
      {
        chipId: "obstacle",
        center: { x: 1.5, y: 1.05 },
        width: 3,
        height: 0.05,
        pins: [],
      },
    ],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }

  const traceA = makeTrace("A", "net0", [
    { x: 0, y: 0 },
    { x: 0, y: 1.0 },
    { x: 3, y: 1.0 },
    { x: 3, y: 2 },
  ])
  const traceB = makeTrace("B", "net0", [
    { x: 0, y: 0.5 },
    { x: 0, y: 1.1 },
    { x: 3, y: 1.1 },
    { x: 3, y: 2.5 },
  ])

  const result = mergeSameNetCloseTraces([traceA, traceB], problemWithChip)

  expect(result[0]!.tracePath[1]!.y).toBeCloseTo(1.0, 10)
  expect(result[1]!.tracePath[1]!.y).toBeCloseTo(1.1, 10)
})

test("single trace per net - no merge needed", () => {
  const traceA = makeTrace("A", "net0", [
    { x: 0, y: 0 },
    { x: 0, y: 1.0 },
    { x: 3, y: 1.0 },
    { x: 3, y: 2 },
  ])

  const result = mergeSameNetCloseTraces([traceA], emptyProblem)

  expect(result).toHaveLength(1)
  expect(result[0]!.tracePath).toEqual(traceA.tracePath)
})
