import { expect, test } from "bun:test"
import type { Point } from "@tscircuit/math-utils"
import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  id: string,
  netId: string,
  tracePath: Point[],
): SolvedTracePath =>
  ({
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    userNetId: netId,
    pins: [] as any,
    mspConnectionPairIds: [id],
    pinIds: [],
    tracePath,
  }) as SolvedTracePath

test("aligns close horizontal same-net internal segments to an existing trunk", () => {
  const solver = new SameNetTraceMergeSolver({
    traces: [
      makeTrace("trunk", "N1", [
        { x: 1, y: 0 },
        { x: 4, y: 0 },
      ]),
      makeTrace("branch", "N1", [
        { x: 0, y: 1 },
        { x: 1, y: 0.06 },
        { x: 4, y: 0.06 },
        { x: 5, y: 1 },
      ]),
    ],
  })

  solver.solve()

  const branchPath = solver.getOutput().traces[1]!.tracePath
  expect(branchPath[1]!.y).toBe(0)
  expect(branchPath[2]!.y).toBe(0)
  expect(solver.stats.mergedSegmentCount).toBeGreaterThan(0)
})

test("aligns close vertical same-net internal segments", () => {
  const solver = new SameNetTraceMergeSolver({
    traces: [
      makeTrace("trunk", "N1", [
        { x: 0, y: 1 },
        { x: 0, y: 4 },
      ]),
      makeTrace("branch", "N1", [
        { x: 1, y: 0 },
        { x: 0.05, y: 1 },
        { x: 0.05, y: 4 },
        { x: 1, y: 5 },
      ]),
    ],
  })

  solver.solve()

  const branchPath = solver.getOutput().traces[1]!.tracePath
  expect(branchPath[1]!.x).toBe(0)
  expect(branchPath[2]!.x).toBe(0)
})

test("does not align segments from different nets", () => {
  const solver = new SameNetTraceMergeSolver({
    traces: [
      makeTrace("trunk", "N1", [
        { x: 1, y: 0 },
        { x: 4, y: 0 },
      ]),
      makeTrace("other-net", "N2", [
        { x: 0, y: 1 },
        { x: 1, y: 0.06 },
        { x: 4, y: 0.06 },
        { x: 5, y: 1 },
      ]),
    ],
  })

  solver.solve()

  const otherPath = solver.getOutput().traces[1]!.tracePath
  expect(otherPath[1]!.y).toBe(0.06)
  expect(otherPath[2]!.y).toBe(0.06)
})

test("rejects same-net alignment that would collide with a different net", () => {
  const solver = new SameNetTraceMergeSolver({
    traces: [
      makeTrace("trunk", "N1", [
        { x: 1, y: 0 },
        { x: 4, y: 0 },
      ]),
      makeTrace("branch", "N1", [
        { x: 0, y: 1 },
        { x: 1, y: 0.06 },
        { x: 4, y: 0.06 },
        { x: 5, y: 1 },
      ]),
      makeTrace("blocked", "N2", [
        { x: 2, y: -1 },
        { x: 2, y: 1 },
      ]),
    ],
  })

  solver.solve()

  const branchPath = solver.getOutput().traces[1]!.tracePath
  expect(branchPath[1]!.y).toBe(0.06)
  expect(branchPath[2]!.y).toBe(0.06)
})
