import { test, expect, describe } from "bun:test"
import { SameNetTraceLineMergeSolver } from "lib/solvers/SameNetTraceLineMergeSolver/SameNetTraceLineMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const minimalInputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

function makeTrace(
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath {
  return {
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [] as any,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
  }
}

describe("SameNetTraceLineMergeSolver", () => {
  test("merges horizontal segments on the same net with close Y values", () => {
    const traceA = makeTrace("pair1", "net1", [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 1.0 },
      { x: 6, y: 1.0 },
    ])
    const traceB = makeTrace("pair2", "net1", [
      { x: 0, y: 0.5 },
      { x: 3, y: 0.5 },
      { x: 3, y: 1.04 },
      { x: 6, y: 1.04 },
    ])

    const solver = new SameNetTraceLineMergeSolver({
      inputProblem: minimalInputProblem,
      inputTracePaths: [traceA, traceB],
      mergeThreshold: 0.06,
    })

    solver.solve()
    expect(solver.solved).toBe(true)

    const resultA = solver.correctedTraceMap["pair1"]!
    const resultB = solver.correctedTraceMap["pair2"]!

    // The segments at Y=1.0 and Y=1.04 should be merged to the same Y
    // (they overlap in X range [3,6])
    const mergedYA = resultA.tracePath[2]!.y
    const mergedYB = resultB.tracePath[2]!.y
    expect(mergedYA).toBeCloseTo(mergedYB, 6)

    // The segments at Y=0 and Y=0.5 should NOT be merged (too far apart)
    expect(resultA.tracePath[0]!.y).toBeCloseTo(0, 6)
    expect(resultB.tracePath[0]!.y).toBeCloseTo(0.5, 6)
  })

  test("merges vertical segments on the same net with close X values", () => {
    const traceA = makeTrace("pair1", "net1", [
      { x: 0, y: 0 },
      { x: 2.0, y: 0 },
      { x: 2.0, y: 3 },
    ])
    const traceB = makeTrace("pair2", "net1", [
      { x: 0, y: 1 },
      { x: 2.05, y: 1 },
      { x: 2.05, y: 3 },
    ])

    const solver = new SameNetTraceLineMergeSolver({
      inputProblem: minimalInputProblem,
      inputTracePaths: [traceA, traceB],
      mergeThreshold: 0.06,
    })

    solver.solve()

    const resultA = solver.correctedTraceMap["pair1"]!
    const resultB = solver.correctedTraceMap["pair2"]!

    // Vertical segments at X=2.0 and X=2.05 should be merged
    const mergedXA = resultA.tracePath[1]!.x
    const mergedXB = resultB.tracePath[1]!.x
    expect(mergedXA).toBeCloseTo(mergedXB, 6)
  })

  test("does NOT merge segments from different nets", () => {
    const traceA = makeTrace("pair1", "net1", [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ])
    const traceB = makeTrace("pair2", "net2", [
      { x: 0, y: 0.03 },
      { x: 5, y: 0.03 },
    ])

    const solver = new SameNetTraceLineMergeSolver({
      inputProblem: minimalInputProblem,
      inputTracePaths: [traceA, traceB],
      mergeThreshold: 0.06,
    })

    solver.solve()

    const resultA = solver.correctedTraceMap["pair1"]!
    const resultB = solver.correctedTraceMap["pair2"]!

    // Different nets: should NOT merge
    expect(resultA.tracePath[0]!.y).toBeCloseTo(0, 6)
    expect(resultB.tracePath[0]!.y).toBeCloseTo(0.03, 6)
  })

  test("does NOT merge segments without range overlap", () => {
    const traceA = makeTrace("pair1", "net1", [
      { x: 0, y: 1.0 },
      { x: 2, y: 1.0 },
    ])
    const traceB = makeTrace("pair2", "net1", [
      { x: 5, y: 1.04 },
      { x: 7, y: 1.04 },
    ])

    const solver = new SameNetTraceLineMergeSolver({
      inputProblem: minimalInputProblem,
      inputTracePaths: [traceA, traceB],
      mergeThreshold: 0.06,
    })

    solver.solve()

    const resultA = solver.correctedTraceMap["pair1"]!
    const resultB = solver.correctedTraceMap["pair2"]!

    // No X-range overlap, should NOT merge
    expect(resultA.tracePath[0]!.y).toBeCloseTo(1.0, 6)
    expect(resultB.tracePath[0]!.y).toBeCloseTo(1.04, 6)
  })

  test("single trace in a net is not modified", () => {
    const traceA = makeTrace("pair1", "net1", [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 3 },
    ])

    const solver = new SameNetTraceLineMergeSolver({
      inputProblem: minimalInputProblem,
      inputTracePaths: [traceA],
    })

    solver.solve()

    const result = solver.correctedTraceMap["pair1"]!
    expect(result.tracePath[0]!.y).toBeCloseTo(0, 6)
    expect(result.tracePath[1]!.x).toBeCloseTo(5, 6)
  })
})
