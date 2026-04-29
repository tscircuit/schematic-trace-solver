import { expect, test } from "bun:test"
import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

test("SameNetTraceMergeSolver - merge touching segments", () => {
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "pair1",
      globalConnNetId: "net1",
      dcConnNetId: "net1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      mspConnectionPairIds: ["pair1"],
      pinIds: ["pin1", "pin2"],
      pins: [] as any,
    },
    {
      mspPairId: "pair2",
      globalConnNetId: "net1",
      dcConnNetId: "net1",
      tracePath: [
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      mspConnectionPairIds: ["pair2"],
      pinIds: ["pin2", "pin3"],
      pins: [] as any,
    },
  ]

  const solver = new SameNetTraceMergeSolver({ traces })
  solver.solve()
  const output = solver.getOutput()

  expect(output.traces).toHaveLength(1)
  expect(output.traces[0].tracePath).toHaveLength(3)
  expect(output.traces[0].tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ])
})

test("SameNetTraceMergeSolver - simplify collinear points", () => {
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "pair1",
      globalConnNetId: "net1",
      dcConnNetId: "net1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 5 },
        { x: 10, y: 10 },
      ],
      mspConnectionPairIds: ["pair1"],
      pinIds: ["pin1", "pin2"],
      pins: [] as any,
    },
  ]

  const solver = new SameNetTraceMergeSolver({ traces })
  solver.solve()
  const output = solver.getOutput()

  expect(output.traces).toHaveLength(1)
  expect(output.traces[0].tracePath).toHaveLength(3)
  expect(output.traces[0].tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ])
})

test("SameNetTraceMergeSolver - don't merge different nets", () => {
    const traces: SolvedTracePath[] = [
      {
        mspPairId: "pair1",
        globalConnNetId: "net1",
        dcConnNetId: "net1",
        tracePath: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        mspConnectionPairIds: ["pair1"],
        pinIds: ["pin1", "pin2"],
        pins: [] as any,
      },
      {
        mspPairId: "pair2",
        globalConnNetId: "net2",
        dcConnNetId: "net2",
        tracePath: [
          { x: 10, y: 0 },
          { x: 10, y: 10 },
        ],
        mspConnectionPairIds: ["pair2"],
        pinIds: ["pin2", "pin3"],
        pins: [] as any,
      },
    ]
  
    const solver = new SameNetTraceMergeSolver({ traces })
    solver.solve()
    const output = solver.getOutput()
  
    expect(output.traces).toHaveLength(2)
  })
