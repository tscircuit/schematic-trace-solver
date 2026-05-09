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
        { x: 1, y: -1 },
        { x: 1, y: 0.1 },
        { x: 3, y: 0.1 },
        { x: 3, y: 1 },
      ]),
    ],
    mergeDistance: 0.15,
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.mergedSegmentCount).toBe(1)
  expect(solver.getOutput().traces[1]!.tracePath).toEqual([
    { x: 1, y: -1 },
    { x: 1, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 1 },
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

test("SameNetTraceCombiningSolver does not detach trace endpoints", () => {
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
  expect(solver.mergedSegmentCount).toBe(0)
  expect(solver.getOutput().traces[1]!.tracePath).toEqual([
    { x: 1, y: 0.1 },
    { x: 3, y: 0.1 },
  ])
})

test("SameNetTraceCombiningSolver recomputes segment refs until close runs collapse", () => {
  const solver = new SameNetTraceCombiningSolver({
    traces: [
      createTrace("trace-a", "net-1", [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ]),
      createTrace("trace-b", "net-1", [
        { x: 1, y: -1 },
        { x: 1, y: 0.1 },
        { x: 3, y: 0.1 },
        { x: 3, y: 1 },
      ]),
      createTrace("trace-c", "net-1", [
        { x: 1.25, y: -1 },
        { x: 1.25, y: 0.14 },
        { x: 2.75, y: 0.14 },
        { x: 2.75, y: 1 },
      ]),
    ],
    mergeDistance: 0.15,
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.mergedSegmentCount).toBe(2)
  expect(solver.getOutput().traces[1]!.tracePath[1]!.y).toBe(0)
  expect(solver.getOutput().traces[1]!.tracePath[2]!.y).toBe(0)
  expect(solver.getOutput().traces[2]!.tracePath[1]!.y).toBe(0)
  expect(solver.getOutput().traces[2]!.tracePath[2]!.y).toBe(0)
})
