import { test, expect } from "bun:test"
import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

/** Helper to build a minimal SolvedTracePath */
function makeTrace(
  id: string,
  netId: string,
  path: Array<{ x: number; y: number }>,
): SolvedTracePath {
  return {
    mspPairId: id,
    globalConnNetId: netId,
    mspConnectionPairIds: [id],
    pinIds: [],
    tracePath: path,
    pins: [],
  } as unknown as SolvedTracePath
}

const emptyInputProblem = { chips: [], connections: [] } as any

test("merges internal horizontal segments of same-net traces that are close together", () => {
  // Two traces on the same net with internal horizontal segments close in Y
  //
  //  trace1: (0,0) → (3,0) → (3,0.1) → (7,0.1) → (7,0) → (10,0)
  //  trace2: (0,5) → (3,5) → (3,0.3) → (7,0.3) → (7,5) → (10,5)
  //
  //  Segments at index 3 are both horizontal, on net1, and only 0.2 apart.
  //  After merging they should snap to their midpoint: y = 0.2
  const trace1 = makeTrace("t1", "net1", [
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 0.1 },
    { x: 7, y: 0.1 },
    { x: 7, y: 0 },
    { x: 10, y: 0 },
  ])

  const trace2 = makeTrace("t2", "net1", [
    { x: 0, y: 5 },
    { x: 3, y: 5 },
    { x: 3, y: 0.3 },
    { x: 7, y: 0.3 },
    { x: 7, y: 5 },
    { x: 10, y: 5 },
  ])

  const solver = new SameNetTraceMergeSolver({
    inputProblem: emptyInputProblem,
    traces: [trace1, trace2],
    mergeThreshold: 0.5,
  })
  solver.solve()

  const out = solver.getOutput()
  expect(out.traces).toHaveLength(2)

  const y1 = out.traces[0]!.tracePath[3]!.y
  const y2 = out.traces[1]!.tracePath[3]!.y

  // Both internal segments should now be at the same Y coordinate
  expect(Math.abs(y1 - y2)).toBeLessThan(1e-6)
  // Midpoint of 0.1 and 0.3 is 0.2
  expect(y1).toBeCloseTo(0.2, 5)
})

test("does not merge segments from different nets", () => {
  const trace1 = makeTrace("t1", "net1", [
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 0.1 },
    { x: 7, y: 0.1 },
    { x: 7, y: 0 },
    { x: 10, y: 0 },
  ])

  const trace2 = makeTrace("t2", "net2", [
    { x: 0, y: 5 },
    { x: 3, y: 5 },
    { x: 3, y: 0.2 },
    { x: 7, y: 0.2 },
    { x: 7, y: 5 },
    { x: 10, y: 5 },
  ])

  const solver = new SameNetTraceMergeSolver({
    inputProblem: emptyInputProblem,
    traces: [trace1, trace2],
    mergeThreshold: 0.5,
  })
  solver.solve()

  const out = solver.getOutput()
  const y1 = out.traces[0]!.tracePath[3]!.y
  const y2 = out.traces[1]!.tracePath[3]!.y

  // Different nets — should NOT be merged
  expect(Math.abs(y1 - y2)).toBeGreaterThan(0.05)
})

test("does not merge segments that are farther apart than the threshold", () => {
  const trace1 = makeTrace("t1", "net1", [
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 0.1 },
    { x: 7, y: 0.1 },
    { x: 7, y: 0 },
    { x: 10, y: 0 },
  ])

  // trace2 has internal horizontal at y=2.0, well outside 0.5 threshold
  const trace2 = makeTrace("t2", "net1", [
    { x: 0, y: 5 },
    { x: 3, y: 5 },
    { x: 3, y: 2.0 },
    { x: 7, y: 2.0 },
    { x: 7, y: 5 },
    { x: 10, y: 5 },
  ])

  const solver = new SameNetTraceMergeSolver({
    inputProblem: emptyInputProblem,
    traces: [trace1, trace2],
    mergeThreshold: 0.5,
  })
  solver.solve()

  const out = solver.getOutput()
  const y1 = out.traces[0]!.tracePath[3]!.y
  const y2 = out.traces[1]!.tracePath[3]!.y

  // Gap is 1.9, much greater than threshold — not merged
  expect(Math.abs(y1 - y2)).toBeGreaterThan(1.0)
})

test("merges internal vertical segments of same-net traces that are close together", () => {
  // Symmetric test for vertical segments
  const trace1 = makeTrace("t1", "net1", [
    { x: 0, y: 0 },
    { x: 0, y: 3 },
    { x: 0.1, y: 3 },
    { x: 0.1, y: 7 },
    { x: 0, y: 7 },
    { x: 0, y: 10 },
  ])

  const trace2 = makeTrace("t2", "net1", [
    { x: 5, y: 0 },
    { x: 5, y: 3 },
    { x: 0.3, y: 3 },
    { x: 0.3, y: 7 },
    { x: 5, y: 7 },
    { x: 5, y: 10 },
  ])

  const solver = new SameNetTraceMergeSolver({
    inputProblem: emptyInputProblem,
    traces: [trace1, trace2],
    mergeThreshold: 0.5,
  })
  solver.solve()

  const out = solver.getOutput()
  const x1 = out.traces[0]!.tracePath[3]!.x
  const x2 = out.traces[1]!.tracePath[3]!.x

  expect(Math.abs(x1 - x2)).toBeLessThan(1e-6)
  expect(x1).toBeCloseTo(0.2, 5)
})
