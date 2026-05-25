import { describe, expect, test } from "bun:test"
import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

// Helper to build a minimal SolvedTracePath
function makePair(
  id: string,
  netId: string,
  points: Array<{ x: number; y: number }>,
): SolvedTracePath {
  return {
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    tracePath: points,
    mspConnectionPairIds: [id],
    pinIds: [],
    pins: [] as any,
  }
}

describe("SameNetTraceMergeSolver", () => {
  test("snaps two overlapping horizontal segments on same net to same Y", () => {
    // Two traces on net "A", both roughly horizontal at Y=1.0 / Y=1.02
    const traces = [
      makePair("t1", "A", [
        { x: 0, y: 1.0 },
        { x: 2, y: 1.0 },
      ]),
      makePair("t2", "A", [
        { x: 1, y: 1.02 },
        { x: 3, y: 1.02 },
      ]),
    ]

    const solver = new SameNetTraceMergeSolver({
      inputProblem: {
        chips: [],
        directConnections: [],
        netConnections: [],
        availableNetLabelOrientations: {},
      },
      allTraces: traces,
    })
    solver.solve()
    const output = solver.getOutput().traces

    // t2 should have been snapped to y=1.0 (t1's fixedCoord)
    const t2 = output.find((t) => t.mspPairId === "t2")!
    expect(t2.tracePath[0]!.y).toBeCloseTo(1.0, 5)
    expect(t2.tracePath[1]!.y).toBeCloseTo(1.0, 5)
  })

  test("does NOT merge segments on different nets", () => {
    const traces = [
      makePair("t1", "A", [
        { x: 0, y: 1.0 },
        { x: 2, y: 1.0 },
      ]),
      makePair("t2", "B", [
        { x: 1, y: 1.01 },
        { x: 3, y: 1.01 },
      ]),
    ]

    const solver = new SameNetTraceMergeSolver({
      inputProblem: {
        chips: [],
        directConnections: [],
        netConnections: [],
        availableNetLabelOrientations: {},
      },
      allTraces: traces,
    })
    solver.solve()
    const output = solver.getOutput().traces

    const t2 = output.find((t) => t.mspPairId === "t2")!
    // y should NOT have been changed — different nets
    expect(t2.tracePath[0]!.y).toBeCloseTo(1.01, 5)
  })

  test("does NOT merge segments that are far apart on same net", () => {
    const traces = [
      makePair("t1", "A", [
        { x: 0, y: 1.0 },
        { x: 1, y: 1.0 },
      ]),
      makePair("t2", "A", [
        { x: 5, y: 2.0 },
        { x: 6, y: 2.0 },
      ]),
    ]

    const solver = new SameNetTraceMergeSolver({
      inputProblem: {
        chips: [],
        directConnections: [],
        netConnections: [],
        availableNetLabelOrientations: {},
      },
      allTraces: traces,
    })
    solver.solve()
    const output = solver.getOutput().traces

    const t2 = output.find((t) => t.mspPairId === "t2")!
    expect(t2.tracePath[0]!.y).toBeCloseTo(2.0, 5)
  })

  test("snaps two overlapping vertical segments on same net to same X", () => {
    const traces = [
      makePair("t1", "A", [
        { x: 1.0, y: 0 },
        { x: 1.0, y: 2 },
      ]),
      makePair("t2", "A", [
        { x: 1.03, y: 1 },
        { x: 1.03, y: 3 },
      ]),
    ]

    const solver = new SameNetTraceMergeSolver({
      inputProblem: {
        chips: [],
        directConnections: [],
        netConnections: [],
        availableNetLabelOrientations: {},
      },
      allTraces: traces,
    })
    solver.solve()
    const output = solver.getOutput().traces

    const t2 = output.find((t) => t.mspPairId === "t2")!
    expect(t2.tracePath[0]!.x).toBeCloseTo(1.0, 5)
    expect(t2.tracePath[1]!.x).toBeCloseTo(1.0, 5)
  })

  test("does not merge segments from same trace", () => {
    // A Z-shaped trace: two horizontal segs in same trace at similar Y
    const traces = [
      makePair("t1", "A", [
        { x: 0, y: 1.0 },
        { x: 1, y: 1.0 },
        { x: 1, y: 1.02 },
        { x: 2, y: 1.02 },
      ]),
    ]

    const solver = new SameNetTraceMergeSolver({
      inputProblem: {
        chips: [],
        directConnections: [],
        netConnections: [],
        availableNetLabelOrientations: {},
      },
      allTraces: traces,
    })
    solver.solve()
    const output = solver.getOutput().traces

    // No mutation — only one trace, no inter-trace merging
    expect(output[0]!.tracePath[2]!.y).toBeCloseTo(1.02, 5)
  })
})
