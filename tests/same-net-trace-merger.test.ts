import { describe, test, expect } from "bun:test"
import { SameNetTraceMergerSolver } from "lib/solvers/SameNetTraceMergerSolver/SameNetTraceMergerSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  id: string,
  netId: string,
  points: { x: number; y: number }[],
): SolvedTracePath =>
  ({
    mspPairId: id,
    globalConnNetId: netId,
    dcConnNetId: netId,
    mspConnectionPairIds: [id],
    pinIds: [],
    tracePath: points,
  }) as any

describe("SameNetTraceMergerSolver", () => {
  test("snaps two nearly-horizontal same-net segments to the same Y", () => {
    const traces = [
      makeTrace("t1", "net1", [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ]),
      makeTrace("t2", "net1", [
        { x: 0, y: 0.1 },
        { x: 2, y: 0.1 },
      ]),
    ]

    const solver = new SameNetTraceMergerSolver({
      inputProblem: { chips: [], connections: [] } as any,
      traces,
      threshold: 0.15,
    })
    solver.solve()

    const out = solver.getOutput().traces
    expect(out[0]!.tracePath[0]!.y).toBeCloseTo(out[1]!.tracePath[0]!.y, 5)
  })

  test("does NOT snap segments from different nets", () => {
    const traces = [
      makeTrace("t1", "net1", [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ]),
      makeTrace("t2", "net2", [
        { x: 0, y: 0.1 },
        { x: 2, y: 0.1 },
      ]),
    ]

    const solver = new SameNetTraceMergerSolver({
      inputProblem: { chips: [], connections: [] } as any,
      traces,
      threshold: 0.15,
    })
    solver.solve()

    const out = solver.getOutput().traces
    expect(out[0]!.tracePath[0]!.y).toBeCloseTo(0, 5)
    expect(out[1]!.tracePath[0]!.y).toBeCloseTo(0.1, 5)
  })

  test("does NOT snap segments farther apart than the threshold", () => {
    const traces = [
      makeTrace("t1", "net1", [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ]),
      makeTrace("t2", "net1", [
        { x: 0, y: 0.5 },
        { x: 2, y: 0.5 },
      ]),
    ]

    const solver = new SameNetTraceMergerSolver({
      inputProblem: { chips: [], connections: [] } as any,
      traces,
      threshold: 0.15,
    })
    solver.solve()

    const out = solver.getOutput().traces
    expect(out[0]!.tracePath[0]!.y).toBeCloseTo(0, 5)
    expect(out[1]!.tracePath[0]!.y).toBeCloseTo(0.5, 5)
  })

  test("snaps two nearly-vertical same-net segments to the same X", () => {
    const traces = [
      makeTrace("t1", "net1", [
        { x: 0, y: 0 },
        { x: 0, y: 2 },
      ]),
      makeTrace("t2", "net1", [
        { x: 0.1, y: 0 },
        { x: 0.1, y: 2 },
      ]),
    ]

    const solver = new SameNetTraceMergerSolver({
      inputProblem: { chips: [], connections: [] } as any,
      traces,
      threshold: 0.15,
    })
    solver.solve()

    const out = solver.getOutput().traces
    expect(out[0]!.tracePath[0]!.x).toBeCloseTo(out[1]!.tracePath[0]!.x, 5)
  })
})
