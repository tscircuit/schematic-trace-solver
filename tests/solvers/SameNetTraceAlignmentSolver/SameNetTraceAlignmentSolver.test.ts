import { test, expect } from "bun:test"
import { SameNetTraceAlignmentSolver } from "lib/solvers/SameNetTraceAlignmentSolver/SameNetTraceAlignmentSolver"
import type { InputProblem } from "lib/types/InputProblem"

const dummyInputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

/**
 * Build a minimal SolvedTracePath-like object for tests.
 */
function makeTrace(
  id: string,
  netId: string,
  path: Array<{ x: number; y: number }>,
) {
  return {
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    userNetId: netId,
    mspConnectionPairIds: [],
    pinIds: [],
    pins: [] as any,
    tracePath: path,
  }
}

test("snaps two close horizontal same-net segments to same Y", () => {
  const traces = [
    makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]),
    makeTrace("t2", "net1", [
      { x: 0, y: 0.08 }, // within SNAP_THRESHOLD of 0
      { x: 2, y: 0.08 },
    ]),
  ]

  const solver = new SameNetTraceAlignmentSolver({
    inputProblem: dummyInputProblem,
    traces,
  })
  solver.solve()

  const { traces: out } = solver.getOutput()
  // Both segments should now be at the same Y (average = 0.04)
  const y0 = out[0]!.tracePath[0]!.y
  const y1 = out[1]!.tracePath[0]!.y
  expect(Math.abs(y0 - y1)).toBeLessThan(1e-9)
})

test("snaps two close vertical same-net segments to same X", () => {
  const traces = [
    makeTrace("t1", "net1", [
      { x: 1, y: 0 },
      { x: 1, y: 3 },
    ]),
    makeTrace("t2", "net1", [
      { x: 1.1, y: 0 }, // 0.1 apart → within threshold
      { x: 1.1, y: 3 },
    ]),
  ]

  const solver = new SameNetTraceAlignmentSolver({
    inputProblem: dummyInputProblem,
    traces,
  })
  solver.solve()

  const { traces: out } = solver.getOutput()
  const x0 = out[0]!.tracePath[0]!.x
  const x1 = out[1]!.tracePath[0]!.x
  expect(Math.abs(x0 - x1)).toBeLessThan(1e-9)
})

test("does NOT snap segments on different nets", () => {
  const traces = [
    makeTrace("t1", "netA", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]),
    makeTrace("t2", "netB", [
      { x: 0, y: 0.05 },
      { x: 2, y: 0.05 },
    ]),
  ]

  const solver = new SameNetTraceAlignmentSolver({
    inputProblem: dummyInputProblem,
    traces,
  })
  solver.solve()

  const { traces: out } = solver.getOutput()
  // Different nets → should stay separate
  expect(out[0]!.tracePath[0]!.y).toBeCloseTo(0, 9)
  expect(out[1]!.tracePath[0]!.y).toBeCloseTo(0.05, 9)
})

test("does NOT snap segments farther than SNAP_THRESHOLD apart", () => {
  const traces = [
    makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]),
    makeTrace("t2", "net1", [
      { x: 0, y: 0.5 }, // 0.5 >> 0.15 threshold
      { x: 2, y: 0.5 },
    ]),
  ]

  const solver = new SameNetTraceAlignmentSolver({
    inputProblem: dummyInputProblem,
    traces,
  })
  solver.solve()

  const { traces: out } = solver.getOutput()
  expect(out[0]!.tracePath[0]!.y).toBeCloseTo(0, 9)
  expect(out[1]!.tracePath[0]!.y).toBeCloseTo(0.5, 9)
})

test("does NOT snap non-overlapping segments on same net", () => {
  // Segments are at same Y but don't overlap on X at all
  const traces = [
    makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("t2", "net1", [
      { x: 5, y: 0.05 }, // Y close but no X overlap with t1
      { x: 6, y: 0.05 },
    ]),
  ]

  const solver = new SameNetTraceAlignmentSolver({
    inputProblem: dummyInputProblem,
    traces,
  })
  solver.solve()

  const { traces: out } = solver.getOutput()
  expect(out[0]!.tracePath[0]!.y).toBeCloseTo(0, 9)
  expect(out[1]!.tracePath[0]!.y).toBeCloseTo(0.05, 9)
})
