import { expect, test } from "bun:test"
import { SameNetTraceCombiningSolver } from "lib/solvers/SameNetTraceCombiningSolver/SameNetTraceCombiningSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const createTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [
      { pinId: `${mspPairId}.1`, x: 0, y: 0, chipId: "U1" },
      { pinId: `${mspPairId}.2`, x: 1, y: 0, chipId: "U2" },
    ],
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [`${mspPairId}.1`, `${mspPairId}.2`],
  }) as SolvedTracePath

test("SameNetTraceCombiningSolver snaps close parallel same-net segments together", () => {
  const solver = new SameNetTraceCombiningSolver({
    traces: [
      createTrace("trace-a", "net-1", [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ]),
      createTrace("trace-b", "net-1", [
        { x: 1, y: 0.1 },
        { x: 3, y: 0.1 },
      ]),
    ],
    mergeDistance: 0.15,
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.mergedSegmentCount).toBe(1)
  expect(solver.getOutput().traces[1]!.tracePath).toEqual([
    { x: 1, y: 0 },
    { x: 3, y: 0 },
  ])
})

test("SameNetTraceCombiningSolver leaves nearby segments on different nets unchanged", () => {
  const solver = new SameNetTraceCombiningSolver({
    traces: [
      createTrace("trace-a", "net-1", [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ]),
      createTrace("trace-b", "net-2", [
        { x: 1, y: 0.1 },
        { x: 3, y: 0.1 },
      ]),
    ],
    mergeDistance: 0.15,
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.mergedSegmentCount).toBe(0)
  expect(solver.getOutput().traces[1]!.tracePath).toEqual([
    { x: 1, y: 0.1 },
    { x: 3, y: 0.1 },
  ])
})
