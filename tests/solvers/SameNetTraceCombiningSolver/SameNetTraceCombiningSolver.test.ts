import { expect, test } from "bun:test"
import { SameNetTraceCombiningSolver } from "lib/solvers/SameNetTraceCombiningSolver/SameNetTraceCombiningSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

test("aligns close overlapping same-net horizontal segments", () => {
  const solver = new SameNetTraceCombiningSolver({
    traces: [
      makeTrace({
        id: "a",
        netId: "net-1",
        tracePath: [
          { x: 0, y: 0 },
          { x: 0, y: 1 },
          { x: 4, y: 1 },
          { x: 4, y: 0 },
        ],
      }),
      makeTrace({
        id: "b",
        netId: "net-1",
        tracePath: [
          { x: 0, y: 2 },
          { x: 0, y: 1.08 },
          { x: 4, y: 1.08 },
          { x: 4, y: 2 },
        ],
      }),
    ],
  })

  solver.solve()

  expect(solver.outputTraces[1]!.tracePath).toEqual([
    { x: 0, y: 2 },
    { x: 0, y: 1 },
    { x: 4, y: 1 },
    { x: 4, y: 2 },
  ])
  expect(solver.stats.combinedSegments).toBe(1)
})

test("aligns close overlapping same-net vertical segments", () => {
  const solver = new SameNetTraceCombiningSolver({
    traces: [
      makeTrace({
        id: "a",
        netId: "net-1",
        tracePath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 4 },
          { x: 0, y: 4 },
        ],
      }),
      makeTrace({
        id: "b",
        netId: "net-1",
        tracePath: [
          { x: 2, y: 0 },
          { x: 1.08, y: 0 },
          { x: 1.08, y: 4 },
          { x: 2, y: 4 },
        ],
      }),
    ],
  })

  solver.solve()

  expect(solver.outputTraces[1]!.tracePath).toEqual([
    { x: 2, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 4 },
    { x: 2, y: 4 },
  ])
})

test("does not align close segments from different nets", () => {
  const originalTracePath = [
    { x: 0, y: 2 },
    { x: 0, y: 1.08 },
    { x: 4, y: 1.08 },
    { x: 4, y: 2 },
  ]
  const solver = new SameNetTraceCombiningSolver({
    traces: [
      makeTrace({
        id: "a",
        netId: "net-1",
        tracePath: [
          { x: 0, y: 0 },
          { x: 0, y: 1 },
          { x: 4, y: 1 },
          { x: 4, y: 0 },
        ],
      }),
      makeTrace({
        id: "b",
        netId: "net-2",
        tracePath: originalTracePath,
      }),
    ],
  })

  solver.solve()

  expect(solver.outputTraces[1]!.tracePath).toEqual(originalTracePath)
  expect(solver.stats.combinedSegments).toBe(0)
})

test("does not move endpoint segments", () => {
  const originalTracePath = [
    { x: 0, y: 1.08 },
    { x: 4, y: 1.08 },
  ]
  const solver = new SameNetTraceCombiningSolver({
    traces: [
      makeTrace({
        id: "a",
        netId: "net-1",
        tracePath: [
          { x: 0, y: 0 },
          { x: 0, y: 1 },
          { x: 4, y: 1 },
          { x: 4, y: 0 },
        ],
      }),
      makeTrace({
        id: "b",
        netId: "net-1",
        tracePath: originalTracePath,
      }),
    ],
  })

  solver.solve()

  expect(solver.outputTraces[1]!.tracePath).toEqual(originalTracePath)
  expect(solver.stats.combinedSegments).toBe(0)
})

const makeTrace = (params: {
  id: string
  netId: string
  tracePath: Array<{ x: number; y: number }>
}): SolvedTracePath =>
  ({
    mspPairId: params.id,
    dcConnNetId: params.netId,
    globalConnNetId: params.netId,
    mspConnectionPairIds: [params.id],
    pinIds: [`${params.id}-1`, `${params.id}-2`],
    pins: [
      {
        pinId: `${params.id}-1`,
        chipId: "U1",
        x: params.tracePath[0]!.x,
        y: params.tracePath[0]!.y,
      },
      {
        pinId: `${params.id}-2`,
        chipId: "U2",
        x: params.tracePath[params.tracePath.length - 1]!.x,
        y: params.tracePath[params.tracePath.length - 1]!.y,
      },
    ],
    tracePath: params.tracePath,
  }) as SolvedTracePath
