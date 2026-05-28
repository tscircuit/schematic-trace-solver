import { expect, test } from "bun:test"
import { SameNetTraceMergerSolver } from "lib/solvers/SameNetTraceMergerSolver/SameNetTraceMergerSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import inputData from "./assets/SameNetTraceMerger.test.input.json"

const emptyProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

// Helper to build a minimal SolvedTracePath
const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  points: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    globalConnNetId,
    dcConnNetId: globalConnNetId,
    pins: [] as any,
    mspConnectionPairIds: [],
    pinIds: [],
    tracePath: points,
  }) as SolvedTracePath

test("snaps two nearly-horizontal same-net segments to same Y", () => {
  const traces = [
    makeTrace("t1", "net.GND", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("t2", "net.GND", [
      { x: 0, y: 0.1 },
      { x: 1, y: 0.1 },
    ]),
  ]
  const solver = new SameNetTraceMergerSolver({
    inputProblem: emptyProblem,
    traces,
  })
  solver.solve()
  const out = solver.getOutput().traces
  expect(out[0]!.tracePath[0]!.y).toBe(out[1]!.tracePath[0]!.y)
})

test("does NOT snap segments from different nets", () => {
  const traces = [
    makeTrace("t1", "net.VCC", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("t2", "net.GND", [
      { x: 0, y: 0.1 },
      { x: 1, y: 0.1 },
    ]),
  ]
  const solver = new SameNetTraceMergerSolver({
    inputProblem: emptyProblem,
    traces,
  })
  solver.solve()
  const out = solver.getOutput().traces
  expect(out[0]!.tracePath[0]!.y).toBe(0)
  expect(out[1]!.tracePath[0]!.y).toBe(0.1)
})

test("does NOT snap segments farther apart than threshold", () => {
  const traces = [
    makeTrace("t1", "net.GND", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("t2", "net.GND", [
      { x: 0, y: 0.5 },
      { x: 1, y: 0.5 },
    ]),
  ]
  const solver = new SameNetTraceMergerSolver({
    inputProblem: emptyProblem,
    traces,
    threshold: 0.15,
  })
  solver.solve()
  const out = solver.getOutput().traces
  expect(out[0]!.tracePath[0]!.y).toBe(0)
  expect(out[1]!.tracePath[0]!.y).toBe(0.5)
})

test("snaps two nearly-vertical same-net segments to same X", () => {
  const traces = [
    makeTrace("t1", "net.GND", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ]),
    makeTrace("t2", "net.GND", [
      { x: 0.08, y: 0 },
      { x: 0.08, y: 1 },
    ]),
  ]
  const solver = new SameNetTraceMergerSolver({
    inputProblem: emptyProblem,
    traces,
  })
  solver.solve()
  const out = solver.getOutput().traces
  expect(out[0]!.tracePath[0]!.x).toBe(out[1]!.tracePath[0]!.x)
})

test("SameNetTraceMergerSolver snapshot", async () => {
  const solver = new SameNetTraceMergerSolver(inputData as any)
  solver.solve()
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
