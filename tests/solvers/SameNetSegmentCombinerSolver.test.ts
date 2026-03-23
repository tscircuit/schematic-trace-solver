import { test, expect } from "bun:test"
import { SameNetSegmentCombinerSolver } from "lib/solvers/SameNetSegmentCombinerSolver/SameNetSegmentCombinerSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const dummyInputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

function makeTrace(
  id: string,
  netId: string,
  path: Array<{ x: number; y: number }>,
): SolvedTracePath {
  return {
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    pins: [
      { pinId: `${id}-p0`, x: path[0]!.x, y: path[0]!.y, chipId: "c1" },
      {
        pinId: `${id}-p1`,
        x: path[path.length - 1]!.x,
        y: path[path.length - 1]!.y,
        chipId: "c2",
      },
    ] as any,
    tracePath: path,
    mspConnectionPairIds: [id],
    pinIds: [`${id}-p0`, `${id}-p1`],
  }
}

test("does not merge traces on different nets", () => {
  const traces = [
    makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("t2", "net2", [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]),
  ]

  const solver = new SameNetSegmentCombinerSolver({
    inputProblem: dummyInputProblem,
    traces,
  })
  solver.solve()

  const output = solver.getOutput()
  expect(output.traces.length).toBe(2)
})

test("merges two same-net traces with touching endpoints (end-to-start)", () => {
  const traces = [
    makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("t2", "net1", [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]),
  ]

  const solver = new SameNetSegmentCombinerSolver({
    inputProblem: dummyInputProblem,
    traces,
  })
  solver.solve()

  const output = solver.getOutput()
  expect(output.traces.length).toBe(1)
  expect(output.traces[0]!.tracePath.length).toBe(2) // collinear points simplified
  expect(output.traces[0]!.tracePath[0]).toEqual({ x: 0, y: 0 })
  expect(output.traces[0]!.tracePath[1]).toEqual({ x: 2, y: 0 })
  expect(output.traces[0]!.pinIds.length).toBe(4)
})

test("merges two same-net traces with close endpoints (within threshold)", () => {
  const traces = [
    makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("t2", "net1", [
      { x: 1.05, y: 0 },
      { x: 2, y: 0 },
    ]),
  ]

  const solver = new SameNetSegmentCombinerSolver({
    inputProblem: dummyInputProblem,
    traces,
  })
  solver.solve()

  const output = solver.getOutput()
  expect(output.traces.length).toBe(1)
})

test("merges two same-net traces with matching end-to-end", () => {
  const traces = [
    makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("t2", "net1", [
      { x: 2, y: 0 },
      { x: 1, y: 0 },
    ]),
  ]

  const solver = new SameNetSegmentCombinerSolver({
    inputProblem: dummyInputProblem,
    traces,
  })
  solver.solve()

  const output = solver.getOutput()
  expect(output.traces.length).toBe(1)
  expect(output.traces[0]!.tracePath[0]).toEqual({ x: 0, y: 0 })
  expect(output.traces[0]!.tracePath[1]).toEqual({ x: 2, y: 0 })
})

test("merges three same-net traces in chain", () => {
  const traces = [
    makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("t2", "net1", [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]),
    makeTrace("t3", "net1", [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ]),
  ]

  const solver = new SameNetSegmentCombinerSolver({
    inputProblem: dummyInputProblem,
    traces,
  })
  solver.solve()

  const output = solver.getOutput()
  expect(output.traces.length).toBe(1)
  expect(output.traces[0]!.mspConnectionPairIds).toContain("t1")
  expect(output.traces[0]!.mspConnectionPairIds).toContain("t2")
  expect(output.traces[0]!.mspConnectionPairIds).toContain("t3")
})

test("does not merge same-net traces that are far apart", () => {
  const traces = [
    makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("t2", "net1", [
      { x: 5, y: 5 },
      { x: 6, y: 5 },
    ]),
  ]

  const solver = new SameNetSegmentCombinerSolver({
    inputProblem: dummyInputProblem,
    traces,
  })
  solver.solve()

  const output = solver.getOutput()
  expect(output.traces.length).toBe(2)
})

test("merges when endpoint is close to a segment of another trace", () => {
  // T-junction: trace t2 ends at a point close to the middle of t1
  const traces = [
    makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]),
    makeTrace("t2", "net1", [
      { x: 1, y: 1 },
      { x: 1, y: 0.05 },
    ]),
  ]

  const solver = new SameNetSegmentCombinerSolver({
    inputProblem: dummyInputProblem,
    traces,
  })
  solver.solve()

  const output = solver.getOutput()
  expect(output.traces.length).toBe(1)
})
