import { expect, test } from "bun:test"
import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const baseTrace = (overrides: Partial<SolvedTracePath>): SolvedTracePath => ({
  mspPairId: "trace",
  dcConnNetId: "dc",
  globalConnNetId: "net-a",
  userNetId: "net-a",
  pins: [
    { pinId: "p1", chipId: "u1", x: 0, y: 0 },
    { pinId: "p2", chipId: "u2", x: 1, y: 1 },
  ],
  tracePath: [],
  mspConnectionPairIds: [],
  pinIds: [],
  ...overrides,
})

test("merges collinear same-net horizontal segments separated by a small gap", () => {
  const solver = new SameNetTraceMergeSolver({
    traces: [
      baseTrace({
        mspPairId: "a",
        tracePath: [
          { x: 0, y: 1 },
          { x: 2, y: 1 },
        ],
      }),
      baseTrace({
        mspPairId: "b",
        tracePath: [
          { x: 2.08, y: 1 },
          { x: 4, y: 1 },
        ],
      }),
    ],
    gapThreshold: 0.15,
  })

  solver.solve()

  expect(solver.getOutput().traces).toHaveLength(1)
  expect(solver.getOutput().traces[0].tracePath).toEqual([
    { x: 0, y: 1 },
    { x: 4, y: 1 },
  ])
  expect(solver.getOutput().traces[0].mspConnectionPairIds).toEqual(["a", "b"])
})

test("does not merge close collinear segments on different nets", () => {
  const solver = new SameNetTraceMergeSolver({
    traces: [
      baseTrace({
        mspPairId: "a",
        globalConnNetId: "net-a",
        tracePath: [
          { x: 0, y: 1 },
          { x: 2, y: 1 },
        ],
      }),
      baseTrace({
        mspPairId: "b",
        globalConnNetId: "net-b",
        tracePath: [
          { x: 2.08, y: 1 },
          { x: 4, y: 1 },
        ],
      }),
    ],
    gapThreshold: 0.15,
  })

  solver.solve()

  expect(solver.getOutput().traces).toHaveLength(2)
})

test("does not merge segments when the gap is larger than the threshold", () => {
  const solver = new SameNetTraceMergeSolver({
    traces: [
      baseTrace({
        mspPairId: "a",
        tracePath: [
          { x: 0, y: 1 },
          { x: 2, y: 1 },
        ],
      }),
      baseTrace({
        mspPairId: "b",
        tracePath: [
          { x: 2.5, y: 1 },
          { x: 4, y: 1 },
        ],
      }),
    ],
    gapThreshold: 0.15,
  })

  solver.solve()

  expect(solver.getOutput().traces).toHaveLength(2)
})
