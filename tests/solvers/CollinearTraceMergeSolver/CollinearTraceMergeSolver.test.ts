import { test, expect } from "bun:test"
import { CollinearTraceMergeSolver } from "lib/solvers/CollinearTraceMergeSolver/CollinearTraceMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const EMPTY_INPUT_PROBLEM = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

/**
 * Helper to make a minimal SolvedTracePath for testing.
 */
function makeTrace(
  id: string,
  netId: string,
  points: Array<{ x: number; y: number }>,
): SolvedTracePath {
  return {
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    userNetId: netId,
    pins: [] as any,
    tracePath: points,
    mspConnectionPairIds: [id],
    pinIds: [],
  }
}

test("merges two overlapping horizontal segments on the same net", () => {
  // Two traces on net "A", both at y=0, x ranges [0,2] and [1,3] → should merge to [0,3]
  const traces: SolvedTracePath[] = [
    makeTrace("t1", "A", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]),
    makeTrace("t2", "A", [
      { x: 1, y: 0 },
      { x: 3, y: 0 },
    ]),
  ]

  const solver = new CollinearTraceMergeSolver({
    inputProblem: EMPTY_INPUT_PROBLEM as any,
    allTraces: traces,
  })
  solver.solve()

  const output = solver.getOutput()
  expect(output.traces).toHaveLength(2)

  // Find the trace that was extended (t1 should now span [0,3])
  const t1 = output.traces.find((t) => t.mspPairId === "t1")!
  const xs = t1.tracePath.map((p) => p.x).sort((a, b) => a - b)
  expect(xs[0]).toBeCloseTo(0)
  expect(xs[xs.length - 1]).toBeCloseTo(3)

  // t2 should be degenerate (collapsed) since it was fully covered
  const t2 = output.traces.find((t) => t.mspPairId === "t2")!
  // The path should have length < 2 or be a zero-length segment; either way the
  // solver must not throw. The trace is effectively absorbed into t1.
  expect(t2).toBeDefined()
})

test("merges two adjacent (touching) horizontal segments on the same net", () => {
  // Traces at y=5, x ranges [0,1] and [1,2] → merge to [0,2]
  const traces: SolvedTracePath[] = [
    makeTrace("t1", "NET1", [
      { x: 0, y: 5 },
      { x: 1, y: 5 },
    ]),
    makeTrace("t2", "NET1", [
      { x: 1, y: 5 },
      { x: 2, y: 5 },
    ]),
  ]

  const solver = new CollinearTraceMergeSolver({
    inputProblem: EMPTY_INPUT_PROBLEM as any,
    allTraces: traces,
  })
  solver.solve()

  const output = solver.getOutput()
  const t1 = output.traces.find((t) => t.mspPairId === "t1")!
  const xs = t1.tracePath.map((p) => p.x).sort((a, b) => a - b)
  expect(xs[0]).toBeCloseTo(0)
  expect(xs[xs.length - 1]).toBeCloseTo(2)
})

test("merges two overlapping vertical segments on the same net", () => {
  // Traces at x=1, y ranges [0,2] and [1,3] → merge to [0,3]
  const traces: SolvedTracePath[] = [
    makeTrace("v1", "VNET", [
      { x: 1, y: 0 },
      { x: 1, y: 2 },
    ]),
    makeTrace("v2", "VNET", [
      { x: 1, y: 1 },
      { x: 1, y: 3 },
    ]),
  ]

  const solver = new CollinearTraceMergeSolver({
    inputProblem: EMPTY_INPUT_PROBLEM as any,
    allTraces: traces,
  })
  solver.solve()

  const output = solver.getOutput()
  const v1 = output.traces.find((t) => t.mspPairId === "v1")!
  const ys = v1.tracePath.map((p) => p.y).sort((a, b) => a - b)
  expect(ys[0]).toBeCloseTo(0)
  expect(ys[ys.length - 1]).toBeCloseTo(3)
})

test("leaves segments on different nets separate", () => {
  // Two horizontal segments at y=0 but different nets — must NOT be merged
  const traces: SolvedTracePath[] = [
    makeTrace("a1", "NET_A", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]),
    makeTrace("b1", "NET_B", [
      { x: 1, y: 0 },
      { x: 3, y: 0 },
    ]),
  ]

  const solver = new CollinearTraceMergeSolver({
    inputProblem: EMPTY_INPUT_PROBLEM as any,
    allTraces: traces,
  })
  solver.solve()

  const output = solver.getOutput()
  const a1 = output.traces.find((t) => t.mspPairId === "a1")!
  const b1 = output.traces.find((t) => t.mspPairId === "b1")!

  // Each trace should remain unchanged
  const a1xs = a1.tracePath.map((p) => p.x).sort((a, b) => a - b)
  expect(a1xs[0]).toBeCloseTo(0)
  expect(a1xs[a1xs.length - 1]).toBeCloseTo(2)

  const b1xs = b1.tracePath.map((p) => p.x).sort((a, b) => a - b)
  expect(b1xs[0]).toBeCloseTo(1)
  expect(b1xs[b1xs.length - 1]).toBeCloseTo(3)
})

test("leaves non-overlapping segments alone", () => {
  // Two horizontal segments at y=0, same net, but x ranges [0,1] and [2,3] — gap between them
  const traces: SolvedTracePath[] = [
    makeTrace("t1", "NET1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("t2", "NET1", [
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]),
  ]

  const solver = new CollinearTraceMergeSolver({
    inputProblem: EMPTY_INPUT_PROBLEM as any,
    allTraces: traces,
  })
  solver.solve()

  const output = solver.getOutput()
  const t1 = output.traces.find((t) => t.mspPairId === "t1")!
  const t2 = output.traces.find((t) => t.mspPairId === "t2")!

  const t1xs = t1.tracePath.map((p) => p.x).sort((a, b) => a - b)
  expect(t1xs[0]).toBeCloseTo(0)
  expect(t1xs[t1xs.length - 1]).toBeCloseTo(1)

  const t2xs = t2.tracePath.map((p) => p.x).sort((a, b) => a - b)
  expect(t2xs[0]).toBeCloseTo(2)
  expect(t2xs[t2xs.length - 1]).toBeCloseTo(3)
})

test("handles multi-segment L-shaped trace (only the horizontal part overlaps)", () => {
  // t1: L-shaped trace: goes from (0,0) → (2,0) → (2,2)
  // t2: horizontal segment at y=0 from (1,0) → (3,0) — overlaps t1's horizontal part
  // The horizontal segments [0,2] and [1,3] should merge to [0,3]
  const traces: SolvedTracePath[] = [
    makeTrace("t1", "NET1", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
    ]),
    makeTrace("t2", "NET1", [
      { x: 1, y: 0 },
      { x: 3, y: 0 },
    ]),
  ]

  const solver = new CollinearTraceMergeSolver({
    inputProblem: EMPTY_INPUT_PROBLEM as any,
    allTraces: traces,
  })
  solver.solve()

  // The solver should not throw and should complete
  expect(solver.solved).toBe(true)
  const output = solver.getOutput()
  expect(output.traces).toHaveLength(2)
})
