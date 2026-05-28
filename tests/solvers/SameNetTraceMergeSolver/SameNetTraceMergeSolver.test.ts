import { test, expect } from "bun:test"
import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  id: string,
  netId: string,
  points: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    tracePath: points,
    mspConnectionPairIds: [id],
    pinIds: [],
    pins: [] as any,
  }) as unknown as SolvedTracePath

const fakeInputProblem = { chips: [], connections: [] } as any

test("merges two same-net traces whose endpoints are adjacent", () => {
  // A→B and B→C on same net: should become A→B→C
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

  const solver = new SameNetTraceMergeSolver({
    inputProblem: fakeInputProblem,
    traces,
  })
  solver.solve()

  const { traces: out } = solver.getOutput()
  expect(out).toHaveLength(1)
  expect(out[0].tracePath).toHaveLength(4)
  expect(out[0].mspConnectionPairIds).toContain("t1")
  expect(out[0].mspConnectionPairIds).toContain("t2")
})

test("merges traces with endpoints within threshold distance", () => {
  // Endpoints within 0.3 (< 0.4 threshold) should merge
  const traces = [
    makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("t2", "net1", [
      { x: 1.2, y: 0 },
      { x: 2, y: 0 },
    ]),
  ]

  const solver = new SameNetTraceMergeSolver({
    inputProblem: fakeInputProblem,
    traces,
  })
  solver.solve()

  expect(solver.getOutput().traces).toHaveLength(1)
})

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

  const solver = new SameNetTraceMergeSolver({
    inputProblem: fakeInputProblem,
    traces,
  })
  solver.solve()

  expect(solver.getOutput().traces).toHaveLength(2)
})

test("does not merge traces whose endpoints are far apart", () => {
  // Gap of 1.0 > 0.4 threshold — should not merge
  const traces = [
    makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("t2", "net1", [
      { x: 2.5, y: 0 },
      { x: 3.5, y: 0 },
    ]),
  ]

  const solver = new SameNetTraceMergeSolver({
    inputProblem: fakeInputProblem,
    traces,
  })
  solver.solve()

  expect(solver.getOutput().traces).toHaveLength(2)
})

test("merges a chain of three same-net traces", () => {
  const traces = [
    makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("t2", "net1", [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]),
    makeTrace("t3", "net1", [
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]),
  ]

  const solver = new SameNetTraceMergeSolver({
    inputProblem: fakeInputProblem,
    traces,
  })
  solver.solve()

  expect(solver.getOutput().traces).toHaveLength(1)
})

test("preserves isolated traces on unrelated nets", () => {
  const traces = [
    makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("t2", "net2", [
      { x: 5, y: 5 },
      { x: 6, y: 5 },
    ]),
    makeTrace("t3", "net3", [
      { x: 10, y: 10 },
      { x: 11, y: 10 },
    ]),
  ]

  const solver = new SameNetTraceMergeSolver({
    inputProblem: fakeInputProblem,
    traces,
  })
  solver.solve()

  // No nets have multiple traces — nothing to merge
  expect(solver.getOutput().traces).toHaveLength(3)
})
