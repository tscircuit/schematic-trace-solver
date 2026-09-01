import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { SameNetTraceJunctionSolver } from "lib/solvers/SameNetTraceJunctionSolver/SameNetTraceJunctionSolver"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [] as any,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    tracePath,
  }) as SolvedTracePath

test("SameNetTraceJunctionSolver snaps same-net endpoints to nearby segments", () => {
  const solver = new SameNetTraceJunctionSolver({
    inputProblem: {
      chips: [],
      directConnections: [],
      netConnections: [],
      availableNetLabelOrientations: {},
    },
    snapThreshold: 0.1,
    traces: [
      makeTrace("a", "net-1", [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ]),
      makeTrace("b", "net-1", [
        { x: 2, y: 0.04 },
        { x: 2, y: 2 },
      ]),
    ],
  })

  solver.solve()
  const traces = solver.getOutput().traces

  expect(traces[0]!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 4, y: 0 },
  ])
  expect(traces[1]!.tracePath[0]).toEqual({ x: 2, y: 0 })
})

test("SameNetTraceJunctionSolver leaves different-net close segments separate", () => {
  const solver = new SameNetTraceJunctionSolver({
    inputProblem: {
      chips: [],
      directConnections: [],
      netConnections: [],
      availableNetLabelOrientations: {},
    },
    snapThreshold: 0.1,
    traces: [
      makeTrace("a", "net-1", [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ]),
      makeTrace("b", "net-2", [
        { x: 2, y: 0.04 },
        { x: 2, y: 2 },
      ]),
    ],
  })

  solver.solve()
  const traces = solver.getOutput().traces

  expect(traces[0]!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 4, y: 0 },
  ])
  expect(traces[1]!.tracePath[0]).toEqual({ x: 2, y: 0.04 })
})
