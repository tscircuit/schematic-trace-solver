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
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [],
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
  }) as any

test("snaps close overlapping same-net internal segments onto a shared axis", () => {
  const traces = [
    makeTrace("a", "gnd", [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]),
    makeTrace("b", "gnd", [
      { x: 1, y: 2 },
      { x: 1, y: 0.08 },
      { x: 9, y: 0.08 },
      { x: 9, y: 2 },
    ]),
  ]

  const solver = new SameNetTraceSegmentMergeSolver({ traces })
  solver.solve()

  expect(solver.getOutput().traces[1]!.tracePath).toEqual([
    { x: 1, y: 2 },
    { x: 1, y: 0 },
    { x: 9, y: 0 },
    { x: 9, y: 2 },
  ])
})

test("does not snap segments from different nets", () => {
  const traces = [
    makeTrace("a", "vcc", [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]),
    makeTrace("b", "gnd", [
      { x: 1, y: 2 },
      { x: 1, y: 0.08 },
      { x: 9, y: 0.08 },
      { x: 9, y: 2 },
    ]),
  ]

  const solver = new SameNetTraceSegmentMergeSolver({ traces })
  solver.solve()

  expect(solver.getOutput().traces[1]!.tracePath[1]!.y).toBe(0.08)
  expect(solver.getOutput().traces[1]!.tracePath[2]!.y).toBe(0.08)
})

test("does not move terminal pin segments", () => {
  const traces = [
    makeTrace("a", "gnd", [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]),
    makeTrace("b", "gnd", [
      { x: 1, y: 0.08 },
      { x: 9, y: 0.08 },
    ]),
  ]

  const solver = new SameNetTraceSegmentMergeSolver({ traces })
  solver.solve()

  expect(solver.getOutput().traces[1]!.tracePath).toEqual([
    { x: 1, y: 0.08 },
    { x: 9, y: 0.08 },
  ])
})

test("requires most of the shorter segment to overlap the target run", () => {
  const traces = [
    makeTrace("a", "gnd", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    makeTrace("b", "gnd", [
      { x: 2, y: 2 },
      { x: 2, y: 0.08 },
      { x: 10, y: 0.08 },
      { x: 10, y: 2 },
    ]),
  ]

  const solver = new SameNetTraceSegmentMergeSolver({ traces })
  solver.solve()

  expect(solver.getOutput().traces[1]!.tracePath[1]!.y).toBe(0.08)
  expect(solver.getOutput().traces[1]!.tracePath[2]!.y).toBe(0.08)
})
