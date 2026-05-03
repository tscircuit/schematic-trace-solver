import { test, expect } from "bun:test"
import { mergeSameNetCloseTraces } from "lib/solvers/TraceCleanupSolver/mergeSameNetCloseTraces"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const emptyInputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

function makePath(points: Array<[number, number]>) {
  return points.map(([x, y]) => ({ x, y }))
}

function makeTrace(
  id: string,
  netId: string,
  points: Array<[number, number]>,
): SolvedTracePath {
  return {
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    pins: [] as any,
    mspConnectionPairIds: [id],
    pinIds: [],
    tracePath: makePath(points),
  }
}

test("horizontal merge - same net, close Y (within threshold), overlapping X", () => {
  // Two internal horizontal segments: A at y=0.0, B at y=0.1
  // Both have internal segments (paths have 4+ points, not endpoints at the matching segs)
  const traces: SolvedTracePath[] = [
    makeTrace("A", "net1", [
      [0, 2],
      [0, 0.0],
      [3, 0.0],
      [3, 2],
    ]),
    makeTrace("B", "net1", [
      [0, -2],
      [0, 0.1],
      [3, 0.1],
      [3, -2],
    ]),
  ]

  const result = mergeSameNetCloseTraces(traces, emptyInputProblem, 0.15)

  // Both internal segments should be snapped to midpoint y=0.05
  const midY = 0.05
  const pathA = result[0]!.tracePath
  const pathB = result[1]!.tracePath

  // Find the y coords of internal points (not first/last)
  const internalYA = pathA.slice(1, -1).map((p) => p.y)
  const internalYB = pathB.slice(1, -1).map((p) => p.y)

  expect(internalYA.some((y) => Math.abs(y - midY) < 0.001)).toBe(true)
  expect(internalYB.some((y) => Math.abs(y - midY) < 0.001)).toBe(true)
})

test("vertical merge - same net, close X (within threshold), overlapping Y", () => {
  const traces: SolvedTracePath[] = [
    makeTrace("A", "net1", [
      [-2, 0],
      [0.0, 0],
      [0.0, 3],
      [-2, 3],
    ]),
    makeTrace("B", "net1", [
      [2, 0],
      [0.1, 0],
      [0.1, 3],
      [2, 3],
    ]),
  ]

  const result = mergeSameNetCloseTraces(traces, emptyInputProblem, 0.15)

  const midX = 0.05
  const pathA = result[0]!.tracePath
  const pathB = result[1]!.tracePath

  const internalXA = pathA.slice(1, -1).map((p) => p.x)
  const internalXB = pathB.slice(1, -1).map((p) => p.x)

  expect(internalXA.some((x) => Math.abs(x - midX) < 0.001)).toBe(true)
  expect(internalXB.some((x) => Math.abs(x - midX) < 0.001)).toBe(true)
})

test("different net - no merge even if close and overlapping", () => {
  const traces: SolvedTracePath[] = [
    makeTrace("A", "net1", [
      [0, 2],
      [0, 0.0],
      [3, 0.0],
      [3, 2],
    ]),
    makeTrace("B", "net2", [
      [0, -2],
      [0, 0.1],
      [3, 0.1],
      [3, -2],
    ]),
  ]

  const result = mergeSameNetCloseTraces(traces, emptyInputProblem, 0.15)

  expect(result[0]!.tracePath).toEqual(traces[0]!.tracePath)
  expect(result[1]!.tracePath).toEqual(traces[1]!.tracePath)
})

test("over threshold - no merge when distance exceeds threshold", () => {
  // Distance is 0.5, threshold is 0.15 - should not merge
  const traces: SolvedTracePath[] = [
    makeTrace("A", "net1", [
      [0, 2],
      [0, 0.0],
      [3, 0.0],
      [3, 2],
    ]),
    makeTrace("B", "net1", [
      [0, -2],
      [0, 0.5],
      [3, 0.5],
      [3, -2],
    ]),
  ]

  const result = mergeSameNetCloseTraces(traces, emptyInputProblem, 0.15)

  expect(result[0]!.tracePath).toEqual(traces[0]!.tracePath)
  expect(result[1]!.tracePath).toEqual(traces[1]!.tracePath)
})

test("non-overlapping X ranges - no merge when intervals don't overlap", () => {
  // Both at y=0.1 apart but X ranges [0,1] and [2,3] don't overlap
  const traces: SolvedTracePath[] = [
    makeTrace("A", "net1", [
      [0, 2],
      [0, 0.0],
      [1, 0.0],
      [1, 2],
    ]),
    makeTrace("B", "net1", [
      [2, -2],
      [2, 0.1],
      [3, 0.1],
      [3, -2],
    ]),
  ]

  const result = mergeSameNetCloseTraces(traces, emptyInputProblem, 0.15)

  expect(result[0]!.tracePath).toEqual(traces[0]!.tracePath)
  expect(result[1]!.tracePath).toEqual(traces[1]!.tracePath)
})

test("endpoint segments are skipped - 2-point traces have no internal segments", () => {
  // Traces with only 2 points: the single segment is an endpoint segment, should not merge
  const traces: SolvedTracePath[] = [
    makeTrace("A", "net1", [
      [0, 0.0],
      [3, 0.0],
    ]),
    makeTrace("B", "net1", [
      [0, 0.1],
      [3, 0.1],
    ]),
  ]

  const result = mergeSameNetCloseTraces(traces, emptyInputProblem, 0.15)

  // With only 2 points both segments are endpoints, so no merge
  expect(result[0]!.tracePath).toEqual(traces[0]!.tracePath)
  expect(result[1]!.tracePath).toEqual(traces[1]!.tracePath)
})

test("collision revert - merge reverted if it causes chip collision", () => {
  const problemWithChip: InputProblem = {
    ...emptyInputProblem,
    chips: [
      {
        chipId: "U1",
        center: { x: 1.5, y: 0.05 },
        width: 3,
        height: 0.5,
        pins: [
          { pinId: "U1.1", x: 0, y: 0.3 },
          { pinId: "U1.2", x: 3, y: 0.3 },
        ],
      },
    ],
  }

  const traces: SolvedTracePath[] = [
    makeTrace("A", "net1", [
      [0, 2],
      [0, 0.0],
      [3, 0.0],
      [3, 2],
    ]),
    makeTrace("B", "net1", [
      [0, -2],
      [0, 0.1],
      [3, 0.1],
      [3, -2],
    ]),
  ]

  const result = mergeSameNetCloseTraces(traces, problemWithChip, 0.15)

  // Merge should be reverted as midpoint y=0.05 goes through chip
  expect(result[0]!.tracePath).toEqual(traces[0]!.tracePath)
  expect(result[1]!.tracePath).toEqual(traces[1]!.tracePath)
})

test("single trace per net - no merge needed", () => {
  const traces: SolvedTracePath[] = [
    makeTrace("A", "net1", [
      [0, 2],
      [0, 0],
      [3, 0],
      [3, 2],
    ]),
  ]

  const result = mergeSameNetCloseTraces(traces, emptyInputProblem)
  expect(result[0]!.tracePath).toEqual(traces[0]!.tracePath)
})
