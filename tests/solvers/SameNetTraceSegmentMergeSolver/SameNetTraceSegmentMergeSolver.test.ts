import { expect, test } from "bun:test"
import { SameNetTraceSegmentMergeSolver } from "lib/solvers/SameNetTraceSegmentMergeSolver/SameNetTraceSegmentMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    globalConnNetId,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    pins: [],
  }) as unknown as SolvedTracePath

test("snaps close same-net horizontal interior segments together", () => {
  const solver = new SameNetTraceSegmentMergeSolver({
    traces: [
      makeTrace("A", "net1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 5, y: 1 },
        { x: 5, y: 0 },
      ]),
      makeTrace("B", "net1", [
        { x: 1, y: 0 },
        { x: 1, y: 1.08 },
        { x: 4, y: 1.08 },
        { x: 4, y: 0 },
      ]),
    ],
  })

  solver.solve()

  const traceB = solver.getOutput().traces.find((t) => t.mspPairId === "B")!
  expect(traceB.tracePath).toEqual([
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 4, y: 1 },
    { x: 4, y: 0 },
  ])
  expect(solver.getOutput().mergedSegmentCount).toBe(1)
})

test("does not snap segments from different nets", () => {
  const solver = new SameNetTraceSegmentMergeSolver({
    traces: [
      makeTrace("A", "net1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 5, y: 1 },
        { x: 5, y: 0 },
      ]),
      makeTrace("B", "net2", [
        { x: 1, y: 0 },
        { x: 1, y: 1.08 },
        { x: 4, y: 1.08 },
        { x: 4, y: 0 },
      ]),
    ],
  })

  solver.solve()

  const traceB = solver.getOutput().traces.find((t) => t.mspPairId === "B")!
  expect(traceB.tracePath[1]).toEqual({ x: 1, y: 1.08 })
  expect(solver.getOutput().mergedSegmentCount).toBe(0)
})

test("keeps endpoint segments fixed to avoid moving pins", () => {
  const solver = new SameNetTraceSegmentMergeSolver({
    traces: [
      makeTrace("A", "net1", [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ]),
      makeTrace("B", "net1", [
        { x: 0, y: 0.08 },
        { x: 5, y: 0.08 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.getOutput().traces[1]!.tracePath).toEqual([
    { x: 0, y: 0.08 },
    { x: 5, y: 0.08 },
  ])
  expect(solver.getOutput().mergedSegmentCount).toBe(0)
})

test("snaps close same-net vertical interior segments together", () => {
  const solver = new SameNetTraceSegmentMergeSolver({
    traces: [
      makeTrace("A", "net1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 5 },
        { x: 0, y: 5 },
      ]),
      makeTrace("B", "net1", [
        { x: 0, y: 1 },
        { x: 1.08, y: 1 },
        { x: 1.08, y: 4 },
        { x: 0, y: 4 },
      ]),
    ],
  })

  solver.solve()

  const traceB = solver.getOutput().traces.find((t) => t.mspPairId === "B")!
  expect(traceB.tracePath).toEqual([
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 4 },
    { x: 0, y: 4 },
  ])
  expect(solver.getOutput().mergedSegmentCount).toBe(1)
})
