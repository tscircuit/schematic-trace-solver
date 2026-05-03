import { test, expect } from "bun:test"
import { mergeSameNetCollinearTraces } from "lib/solvers/TraceCleanupSolver/mergeSameNetCollinearTraces"
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

test("collinear horizontal segments - same Y, contiguous: merge extends both traces", () => {
  // Two traces on the same net: trace A covers x=[0,2] at y=0, trace B covers x=[2,4] at y=0
  // After merge both should cover x=[0,4] at y=0
  const traces: SolvedTracePath[] = [
    makeTrace("A", "net1", [
      [0, 1],
      [0, 0],
      [2, 0],
      [2, 1],
    ]),
    makeTrace("B", "net1", [
      [4, 1],
      [4, 0],
      [2, 0],
      [2, 1],
    ]),
  ]

  const result = mergeSameNetCollinearTraces(traces, emptyInputProblem)

  // Both traces should have a segment spanning x=0 to x=4 at y=0
  const pathA = result[0]!.tracePath
  const pathB = result[1]!.tracePath

  // Each merged trace horizontal segment should now span [0, 4]
  const xCoordsA = pathA.map((p) => p.x)
  const xCoordsB = pathB.map((p) => p.x)

  expect(xCoordsA).toContain(0)
  expect(xCoordsA).toContain(4)
  expect(xCoordsB).toContain(0)
  expect(xCoordsB).toContain(4)
})

test("collinear vertical segments - same X, contiguous: merge extends both traces", () => {
  const traces: SolvedTracePath[] = [
    makeTrace("A", "net1", [
      [1, 0],
      [0, 0],
      [0, 2],
      [1, 2],
    ]),
    makeTrace("B", "net1", [
      [1, 4],
      [0, 4],
      [0, 2],
      [1, 2],
    ]),
  ]

  const result = mergeSameNetCollinearTraces(traces, emptyInputProblem)

  const pathA = result[0]!.tracePath
  const pathB = result[1]!.tracePath

  const yCoordsA = pathA.map((p) => p.y)
  const yCoordsB = pathB.map((p) => p.y)

  expect(yCoordsA).toContain(0)
  expect(yCoordsA).toContain(4)
  expect(yCoordsB).toContain(0)
  expect(yCoordsB).toContain(4)
})

test("different nets - no merge even if collinear and contiguous", () => {
  const traces: SolvedTracePath[] = [
    makeTrace("A", "net1", [
      [0, 1],
      [0, 0],
      [2, 0],
      [2, 1],
    ]),
    makeTrace("B", "net2", [
      [4, 1],
      [4, 0],
      [2, 0],
      [2, 1],
    ]),
  ]

  const result = mergeSameNetCollinearTraces(traces, emptyInputProblem)

  // Paths should be unchanged since nets are different
  expect(result[0]!.tracePath).toEqual(traces[0]!.tracePath)
  expect(result[1]!.tracePath).toEqual(traces[1]!.tracePath)
})

test("same net, collinear but gap too large - no merge", () => {
  // Traces are on same Y but have a gap of 2 (well above default 0.1 tolerance)
  const traces: SolvedTracePath[] = [
    makeTrace("A", "net1", [
      [0, 1],
      [0, 0],
      [1, 0],
      [1, 1],
    ]),
    makeTrace("B", "net1", [
      [5, 1],
      [5, 0],
      [3, 0],
      [3, 1],
    ]),
  ]

  const result = mergeSameNetCollinearTraces(traces, emptyInputProblem)

  // Gap is 2 (x=1 to x=3), above default tolerance 0.1, so no merge
  expect(result[0]!.tracePath).toEqual(traces[0]!.tracePath)
  expect(result[1]!.tracePath).toEqual(traces[1]!.tracePath)
})

test("same net, collinear overlapping - traces are extended to union", () => {
  // Overlapping horizontal segments: A=[0,3], B=[2,5] on same Y
  const traces: SolvedTracePath[] = [
    makeTrace("A", "net1", [
      [0, 1],
      [0, 0],
      [3, 0],
      [3, 1],
    ]),
    makeTrace("B", "net1", [
      [5, 1],
      [5, 0],
      [2, 0],
      [2, 1],
    ]),
  ]

  const result = mergeSameNetCollinearTraces(traces, emptyInputProblem)

  const xCoordsA = result[0]!.tracePath.map((p) => p.x)
  const xCoordsB = result[1]!.tracePath.map((p) => p.x)

  // Both should cover [0, 5]
  expect(xCoordsA).toContain(0)
  expect(xCoordsA).toContain(5)
  expect(xCoordsB).toContain(0)
  expect(xCoordsB).toContain(5)
})

test("chip obstacle collision - merge reverted", () => {
  const problemWithChip: InputProblem = {
    ...emptyInputProblem,
    chips: [
      {
        chipId: "U1",
        center: { x: 2.5, y: 0 },
        width: 1,
        height: 1,
        pins: [
          { pinId: "U1.1", x: 2, y: -0.5 },
          { pinId: "U1.2", x: 3, y: -0.5 },
        ],
      },
    ],
  }

  // The merged segment would pass through the chip at x=2.5
  const traces: SolvedTracePath[] = [
    makeTrace("A", "net1", [
      [0, 1],
      [0, 0],
      [2, 0],
      [2, 1],
    ]),
    makeTrace("B", "net1", [
      [5, 1],
      [5, 0],
      [3, 0],
      [3, 1],
    ]),
  ]

  const result = mergeSameNetCollinearTraces(traces, problemWithChip)

  // Merge should be skipped due to chip collision
  expect(result[0]!.tracePath).toEqual(traces[0]!.tracePath)
  expect(result[1]!.tracePath).toEqual(traces[1]!.tracePath)
})

test("single trace per net - no merge attempted", () => {
  const traces: SolvedTracePath[] = [
    makeTrace("A", "net1", [
      [0, 1],
      [0, 0],
      [2, 0],
      [2, 1],
    ]),
  ]

  const result = mergeSameNetCollinearTraces(traces, emptyInputProblem)
  expect(result[0]!.tracePath).toEqual(traces[0]!.tracePath)
})
