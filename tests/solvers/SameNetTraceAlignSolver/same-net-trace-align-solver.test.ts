import { test, expect } from "bun:test"
import { SameNetTraceAlignSolver } from "../../../lib/solvers/SameNetTraceAlignSolver/SameNetTraceAlignSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

function makeTrace(
  mspPairId: string,
  globalConnNetId: string,
  path: { x: number; y: number }[]
): SolvedTracePath {
  return {
    mspPairId,
    globalConnNetId,
    tracePath: path,
    inputProblem: { chips: [], pins: [], ports: [] },
  } as any
}

test("SameNetTraceAlignSolver aligns two horizontal segments close in Y", () => {
  // Two simple horizontal traces in same net, endpoints at Y=1.0 and Y=1.1 (diff=0.1, within threshold 0.19)
  const traces: SolvedTracePath[] = [
    makeTrace("trace-a", "net-1", [
      { x: 0, y: 1.0 },
      { x: 5, y: 1.0 },
    ]),
    makeTrace("trace-b", "net-1", [
      { x: 10, y: 1.1 },
      { x: 15, y: 1.1 },
    ]),
  ]

  const solver = new SameNetTraceAlignSolver(traces, 0.19)
  while (!solver.solved) solver.step()

  const output = solver.getOutput()
  const y0 = output.traces[0].tracePath[0].y
  const y1 = output.traces[1].tracePath[0].y

  // Both should align to average ≈ 1.05
  expect(Math.abs(y0 - y1)).toBeLessThan(0.01)
  expect(Math.abs(y0 - 1.05)).toBeLessThan(0.01)
})

test("SameNetTraceAlignSolver aligns two vertical segments close in X", () => {
  // Two simple vertical traces in same net, endpoints at X=2.0 and X=2.08 (diff=0.08, within threshold 0.19)
  const traces: SolvedTracePath[] = [
    makeTrace("trace-a", "net-1", [
      { x: 2.0, y: 0 },
      { x: 2.0, y: 5 },
    ]),
    makeTrace("trace-b", "net-1", [
      { x: 2.08, y: 10 },
      { x: 2.08, y: 15 },
    ]),
  ]

  const solver = new SameNetTraceAlignSolver(traces, 0.19)
  while (!solver.solved) solver.step()

  const output = solver.getOutput()
  const x0 = output.traces[0].tracePath[0].x
  const x1 = output.traces[1].tracePath[0].x

  // Both should align to average ≈ 2.04
  expect(Math.abs(x0 - x1)).toBeLessThan(0.01)
  expect(Math.abs(x0 - 2.04)).toBeLessThan(0.01)
})

test("SameNetTraceAlignSolver does NOT align segments far apart", () => {
  // Two horizontal traces at Y=1.0 and Y=5.0 (diff=4.0, OUTSIDE threshold)
  const traces: SolvedTracePath[] = [
    makeTrace("trace-a", "net-1", [
      { x: 0, y: 1.0 },
      { x: 5, y: 1.0 },
    ]),
    makeTrace("trace-b", "net-1", [
      { x: 10, y: 5.0 },
      { x: 15, y: 5.0 },
    ]),
  ]

  const solver = new SameNetTraceAlignSolver(traces, 0.19)
  while (!solver.solved) solver.step()

  const output = solver.getOutput()
  const y0 = output.traces[0].tracePath[0].y
  const y1 = output.traces[1].tracePath[0].y

  // Should NOT be aligned (difference should be ~4.0)
  expect(Math.abs(y0 - y1)).toBeGreaterThan(1.0)
})

test("SameNetTraceAlignSolver does not touch different nets", () => {
  // Two horizontal traces in DIFFERENT nets at Y=1.0 and Y=1.1 (close but different nets)
  const traces: SolvedTracePath[] = [
    makeTrace("trace-a", "net-1", [
      { x: 0, y: 1.0 },
      { x: 5, y: 1.0 },
    ]),
    makeTrace("trace-b", "net-2", [
      { x: 10, y: 1.1 },
      { x: 15, y: 1.1 },
    ]),
  ]

  const solver = new SameNetTraceAlignSolver(traces, 0.19)
  while (!solver.solved) solver.step()

  const output = solver.getOutput()
  const y0 = output.traces[0].tracePath[0].y
  const y1 = output.traces[1].tracePath[0].y

  // Should NOT be aligned because different nets
  expect(Math.abs(y0 - y1)).toBeGreaterThan(0.01)
})