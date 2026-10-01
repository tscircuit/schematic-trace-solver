import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { SameNetTraceCombiningSolver } from "lib/solvers/SameNetTraceCombiningSolver/SameNetTraceCombiningSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"

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

  expect(solver.getOutput().traces[1]!.tracePath).toEqual([
    { x: 0, y: 2 },
    { x: 0, y: 1 },
    { x: 4, y: 1 },
    { x: 4, y: 2 },
  ])
  expect(solver.getOutput().combinedSegments).toBe(1)
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

  expect(solver.getOutput().traces[1]!.tracePath).toEqual([
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

  expect(solver.getOutput().traces[1]!.tracePath).toEqual(originalTracePath)
  expect(solver.getOutput().combinedSegments).toBe(0)
})

test("does not move endpoint-only segments", () => {
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

  expect(solver.getOutput().traces[1]!.tracePath).toEqual(originalTracePath)
  expect(solver.getOutput().combinedSegments).toBe(0)
})

test("requires overlapping projected segment ranges", () => {
  const originalTracePath = [
    { x: 5, y: 2 },
    { x: 5, y: 1.08 },
    { x: 9, y: 1.08 },
    { x: 9, y: 2 },
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

  expect(solver.getOutput().traces[1]!.tracePath).toEqual(originalTracePath)
  expect(solver.getOutput().combinedSegments).toBe(0)
})

test("rejects candidates that introduce a different-net crossing", () => {
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
        netId: "net-1",
        tracePath: originalTracePath,
      }),
      makeTrace({
        id: "c",
        netId: "net-2",
        tracePath: [
          { x: 2, y: 0.5 },
          { x: 2, y: 1.05 },
        ],
      }),
    ],
  })

  solver.solve()

  expect(solver.getOutput().traces[1]!.tracePath).toEqual(originalTracePath)
  expect(solver.getOutput().combinedSegments).toBe(0)
})

test("uses the configured max distance", () => {
  const originalTracePath = [
    { x: 0, y: 2 },
    { x: 0, y: 1.3 },
    { x: 4, y: 1.3 },
    { x: 4, y: 2 },
  ]
  const solver = new SameNetTraceCombiningSolver({
    maxDistance: 0.15,
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

  expect(solver.getOutput().traces[1]!.tracePath).toEqual(originalTracePath)
  expect(solver.getOutput().combinedSegments).toBe(0)
})

test("is wired as a post-cleanup pipeline phase", () => {
  const solver = new SchematicTracePipelineSolver({
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  } as any)
  const phaseNames = solver.pipelineDef.map((step) => step.solverName)

  expect(phaseNames.indexOf("sameNetTraceCombiningSolver")).toBe(
    phaseNames.indexOf("traceCleanupSolver") + 1,
  )
  expect(phaseNames.indexOf("sameNetTraceCombiningSolver")).toBeLessThan(
    phaseNames.indexOf("example28Solver"),
  )
})

const makeTrace = (params: {
  id: string
  netId: string
  tracePath: PointLike[]
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

interface PointLike {
  x: number
  y: number
}
