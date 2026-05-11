import { expect, test } from "bun:test"
import { SameNetTraceConsolidationSolver } from "lib/solvers/SameNetTraceConsolidationSolver/SameNetTraceConsolidationSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [
      { pinId: `${mspPairId}-a`, chipId: "U1", x: 0, y: 0 },
      { pinId: `${mspPairId}-b`, chipId: "U2", x: 0, y: 0 },
    ],
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [`${mspPairId}-a`, `${mspPairId}-b`],
  }) as SolvedTracePath

test("consolidates close overlapping internal same-net horizontal runs", () => {
  const solver = new SameNetTraceConsolidationSolver({
    traces: [
      makeTrace("trace-a", "net-a", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 2 },
      ]),
      makeTrace("trace-b", "net-a", [
        { x: 1, y: 3 },
        { x: 1, y: 1.1 },
        { x: 3, y: 1.1 },
        { x: 3, y: 4 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.getOutput().movedSegments).toEqual([
    {
      mspPairId: "trace-b",
      segmentIndex: 1,
      orientation: "horizontal",
      from: 1.1,
      to: 1,
    },
  ])
  expect(solver.getOutput().traces[1]!.tracePath).toEqual([
    { x: 1, y: 3 },
    { x: 1, y: 1 },
    { x: 3, y: 1 },
    { x: 3, y: 4 },
  ])
})

test("consolidates close overlapping internal same-net vertical runs", () => {
  const solver = new SameNetTraceConsolidationSolver({
    traces: [
      makeTrace("trace-a", "net-a", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 4 },
        { x: 2, y: 4 },
      ]),
      makeTrace("trace-b", "net-a", [
        { x: 3, y: 1 },
        { x: 1.1, y: 1 },
        { x: 1.1, y: 3 },
        { x: 4, y: 3 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.getOutput().movedSegments).toHaveLength(1)
  expect(solver.getOutput().traces[1]!.tracePath).toEqual([
    { x: 3, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 3 },
    { x: 4, y: 3 },
  ])
})

test("leaves endpoint-only traces unchanged", () => {
  const solver = new SameNetTraceConsolidationSolver({
    traces: [
      makeTrace("trace-a", "net-a", [
        { x: 0, y: 1 },
        { x: 4, y: 1 },
      ]),
      makeTrace("trace-b", "net-a", [
        { x: 1, y: 1.1 },
        { x: 3, y: 1.1 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.getOutput().movedSegments).toHaveLength(0)
  expect(solver.getOutput().traces[1]!.tracePath[0]!.y).toBe(1.1)
})

test("rejects a same-net snap when it would cross a different net", () => {
  const solver = new SameNetTraceConsolidationSolver({
    traces: [
      makeTrace("trace-a", "net-a", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 2 },
      ]),
      makeTrace("trace-b", "net-a", [
        { x: 1, y: 3 },
        { x: 1, y: 1.1 },
        { x: 3, y: 1.1 },
        { x: 3, y: 4 },
      ]),
      makeTrace("trace-c", "net-b", [
        { x: 2, y: 0.5 },
        { x: 2, y: 1.5 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.getOutput().movedSegments).toHaveLength(0)
  expect(solver.getOutput().traces[1]!.tracePath[1]!.y).toBe(1.1)
})

test("continues after a blocked candidate and applies another valid snap", () => {
  const solver = new SameNetTraceConsolidationSolver({
    traces: [
      makeTrace("blocked-a", "net-a", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 2 },
      ]),
      makeTrace("blocked-b", "net-a", [
        { x: 1, y: 3 },
        { x: 1, y: 1.05 },
        { x: 3, y: 1.05 },
        { x: 3, y: 4 },
      ]),
      makeTrace("blocker", "net-b", [
        { x: 2, y: 0.8 },
        { x: 2, y: 1.2 },
      ]),
      makeTrace("valid-a", "net-a", [
        { x: 5, y: 0 },
        { x: 5, y: 2 },
        { x: 8, y: 2 },
        { x: 8, y: 3 },
      ]),
      makeTrace("valid-b", "net-a", [
        { x: 6, y: 4 },
        { x: 6, y: 2.05 },
        { x: 7, y: 2.05 },
        { x: 7, y: 5 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.getOutput().movedSegments).toEqual([
    {
      mspPairId: "valid-b",
      segmentIndex: 1,
      orientation: "horizontal",
      from: 2.05,
      to: 2,
    },
  ])
  expect(solver.getOutput().traces[1]!.tracePath[1]!.y).toBe(1.05)
  expect(solver.getOutput().traces[4]!.tracePath[1]!.y).toBe(2)
})
