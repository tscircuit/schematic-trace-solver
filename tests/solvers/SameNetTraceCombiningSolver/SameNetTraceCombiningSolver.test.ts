import { expect, test } from "bun:test"
import { SameNetTraceCombiningSolver } from "lib/solvers/SameNetTraceCombiningSolver/SameNetTraceCombiningSolver"
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
      { pinId: `${mspPairId}-a`, chipId: "chip-a", x: 0, y: 0 },
      { pinId: `${mspPairId}-b`, chipId: "chip-b", x: 0, y: 0 },
    ],
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [`${mspPairId}-a`, `${mspPairId}-b`],
  }) as SolvedTracePath

test("snaps close overlapping internal same-net segments onto a shared run", () => {
  const solver = new SameNetTraceCombiningSolver({
    mergeDistance: 0.15,
    traces: [
      makeTrace("a", "net-1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 2 },
      ]),
      makeTrace("b", "net-1", [
        { x: 1, y: 3 },
        { x: 1, y: 1.1 },
        { x: 3, y: 1.1 },
        { x: 3, y: 4 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.getOutput().movedSegments).toHaveLength(1)
  expect(solver.getOutput().traces[1]!.tracePath).toEqual([
    { x: 1, y: 3 },
    { x: 1, y: 1 },
    { x: 3, y: 1 },
    { x: 3, y: 4 },
  ])
})

test("snaps close overlapping vertical same-net segments onto a shared run", () => {
  const solver = new SameNetTraceCombiningSolver({
    mergeDistance: 0.15,
    traces: [
      makeTrace("a", "net-1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 4 },
        { x: 2, y: 4 },
      ]),
      makeTrace("b", "net-1", [
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

test("does not move pin endpoint segments", () => {
  const solver = new SameNetTraceCombiningSolver({
    mergeDistance: 0.15,
    traces: [
      makeTrace("a", "net-1", [
        { x: 0, y: 1 },
        { x: 4, y: 1 },
      ]),
      makeTrace("b", "net-1", [
        { x: 1, y: 1.1 },
        { x: 3, y: 1.1 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.getOutput().movedSegments).toHaveLength(0)
  expect(solver.getOutput().traces[1]!.tracePath).toEqual([
    { x: 1, y: 1.1 },
    { x: 3, y: 1.1 },
  ])
})

test("leaves same-net segments alone when distance or overlap thresholds fail", () => {
  const solver = new SameNetTraceCombiningSolver({
    mergeDistance: 0.15,
    minOverlap: 0.5,
    traces: [
      makeTrace("a", "net-1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 2 },
      ]),
      makeTrace("b", "net-1", [
        { x: 4.9, y: 3 },
        { x: 4.9, y: 1.1 },
        { x: 5.2, y: 1.1 },
        { x: 5.2, y: 4 },
      ]),
      makeTrace("c", "net-1", [
        { x: 1, y: 3 },
        { x: 1, y: 1.25 },
        { x: 3, y: 1.25 },
        { x: 3, y: 4 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.getOutput().movedSegments).toHaveLength(0)
  expect(solver.getOutput().traces[1]!.tracePath[1]!.y).toBe(1.1)
  expect(solver.getOutput().traces[2]!.tracePath[1]!.y).toBe(1.25)
})

test("rejects snaps that would cross a different net", () => {
  const solver = new SameNetTraceCombiningSolver({
    mergeDistance: 0.15,
    traces: [
      makeTrace("a", "net-1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 2 },
      ]),
      makeTrace("b", "net-1", [
        { x: 1, y: 3 },
        { x: 1, y: 1.1 },
        { x: 3, y: 1.1 },
        { x: 3, y: 4 },
      ]),
      makeTrace("c", "net-2", [
        { x: 2, y: 0.5 },
        { x: 2, y: 1.5 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.getOutput().movedSegments).toHaveLength(0)
  expect(solver.getOutput().traces[1]!.tracePath[1]!.y).toBe(1.1)
})
