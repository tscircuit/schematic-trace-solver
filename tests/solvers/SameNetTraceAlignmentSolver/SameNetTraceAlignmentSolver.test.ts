import { test, expect } from "bun:test"
import { SameNetTraceAlignmentSolver } from "lib/solvers/SameNetTraceAlignmentSolver/SameNetTraceAlignmentSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const FAKE_INPUT_PROBLEM: any = {
  chips: [],
  directConnections: [],
  netConnections: [],
}

/**
 * Build a minimal SolvedTracePath for testing.
 */
function makePath(
  id: string,
  netId: string,
  points: Array<{ x: number; y: number }>,
): SolvedTracePath {
  return {
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    pins: [] as any,
    tracePath: points,
    mspConnectionPairIds: [id],
    pinIds: [],
  }
}

test("SameNetTraceAlignmentSolver: snaps two close parallel horizontal segments", () => {
  // Two horizontal traces on the same net at y=0 and y=0.2 (within threshold)
  // with overlapping x ranges.
  const traces: SolvedTracePath[] = [
    makePath("a-b", "NET1", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]),
    makePath("c-d", "NET1", [
      { x: 0.5, y: 0.2 },
      { x: 1.5, y: 0.2 },
    ]),
  ]

  const solver = new SameNetTraceAlignmentSolver({
    inputProblem: FAKE_INPUT_PROBLEM,
    traces,
    snapThreshold: 0.4,
  })
  solver.solve()

  const out = solver.getOutput().traces
  const traceA = out.find((t) => t.mspPairId === "a-b")!
  const traceB = out.find((t) => t.mspPairId === "c-d")!

  // Both should be snapped to the same Y
  const yA = traceA.tracePath[0]!.y
  const yB = traceB.tracePath[0]!.y
  expect(yA).toBe(yB)

  // The snapped Y should be the average: (0 + 0.2) / 2 = 0.1
  expect(yA).toBeCloseTo(0.1)
})

test("SameNetTraceAlignmentSolver: does NOT snap segments beyond threshold", () => {
  const traces: SolvedTracePath[] = [
    makePath("a-b", "NET2", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]),
    makePath("c-d", "NET2", [
      { x: 0, y: 1.0 },
      { x: 2, y: 1.0 },
    ]),
  ]

  const solver = new SameNetTraceAlignmentSolver({
    inputProblem: FAKE_INPUT_PROBLEM,
    traces,
    snapThreshold: 0.4,
  })
  solver.solve()

  const out = solver.getOutput().traces
  const yA = out.find((t) => t.mspPairId === "a-b")!.tracePath[0]!.y
  const yB = out.find((t) => t.mspPairId === "c-d")!.tracePath[0]!.y

  // Should remain unchanged
  expect(yA).toBeCloseTo(0)
  expect(yB).toBeCloseTo(1.0)
})

test("SameNetTraceAlignmentSolver: does NOT snap segments from different nets", () => {
  const traces: SolvedTracePath[] = [
    makePath("a-b", "NET_A", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]),
    makePath("c-d", "NET_B", [
      { x: 0, y: 0.1 },
      { x: 2, y: 0.1 },
    ]),
  ]

  const solver = new SameNetTraceAlignmentSolver({
    inputProblem: FAKE_INPUT_PROBLEM,
    traces,
    snapThreshold: 0.4,
  })
  solver.solve()

  const out = solver.getOutput().traces
  const yA = out.find((t) => t.mspPairId === "a-b")!.tracePath[0]!.y
  const yB = out.find((t) => t.mspPairId === "c-d")!.tracePath[0]!.y

  expect(yA).toBeCloseTo(0)
  expect(yB).toBeCloseTo(0.1)
})

test("SameNetTraceAlignmentSolver: snaps close vertical segments", () => {
  const traces: SolvedTracePath[] = [
    makePath("a-b", "NET3", [
      { x: 0, y: 0 },
      { x: 0, y: 2 },
    ]),
    makePath("c-d", "NET3", [
      { x: 0.15, y: 0.5 },
      { x: 0.15, y: 1.5 },
    ]),
  ]

  const solver = new SameNetTraceAlignmentSolver({
    inputProblem: FAKE_INPUT_PROBLEM,
    traces,
    snapThreshold: 0.4,
  })
  solver.solve()

  const out = solver.getOutput().traces
  const xA = out.find((t) => t.mspPairId === "a-b")!.tracePath[0]!.x
  const xB = out.find((t) => t.mspPairId === "c-d")!.tracePath[0]!.x

  expect(xA).toBe(xB)
  expect(xA).toBeCloseTo(0.075)
})
