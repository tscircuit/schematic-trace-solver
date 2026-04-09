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

test("SameNetTraceMergeSolver - merge partially overlapping segments", () => {
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
        { x: 5, y: 0 },
        { x: 15, y: 0 },
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
  expect(output.traces[0].tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 15, y: 0 },
  ])
})

test("SameNetTraceMergeSolver - handle T-junction", () => {
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "main",
      globalConnNetId: "net1",
      dcConnNetId: "net1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
      ],
      mspConnectionPairIds: ["main"],
      pinIds: ["p1", "p2"],
      pins: [] as any,
    },
    {
      mspPairId: "branch",
      globalConnNetId: "net1",
      dcConnNetId: "net1",
      tracePath: [
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      mspConnectionPairIds: ["branch"],
      pinIds: ["p2", "p3"],
      pins: [] as any,
    },
  ]

  const solver = new SameNetTraceMergeSolver({ traces })
  solver.solve()
  const output = solver.getOutput()

  // In a T-junction, we expect 2 traces meeting at {10, 0}
  // One could be {0,0} to {10,0}, {10,0} to {20,0}, and {10,0} to {10,10}
  // Our reconstructPaths splits at junctions, so we might get 3 traces if it splits the main line
  // OR it might keep the main line and have the branch touch it.
  // Current implementation: degree 3 node at {10,0}. 
  // Leaves are {0,0}, {20,0}, {10,10}.
  // We'll get 3 paths from the junction: [10,0]->[0,0], [10,0]->[20,0], [10,0]->[10,10].
  expect(output.traces).toHaveLength(3)
  
  const allPoints = output.traces.map(t => t.tracePath)
  expect(allPoints).toContainEqual([{ x: 10, y: 0 }, { x: 0, y: 0 }])
  expect(allPoints).toContainEqual([{ x: 10, y: 0 }, { x: 20, y: 0 }])
  expect(allPoints).toContainEqual([{ x: 10, y: 0 }, { x: 10, y: 10 }])
})

test("SameNetTraceMergeSolver - remove redundant overlapping trace", () => {
    const traces: SolvedTracePath[] = [
      {
        mspPairId: "long",
        globalConnNetId: "net1",
        dcConnNetId: "net1",
        tracePath: [{ x: 0, y: 0 }, { x: 20, y: 0 }],
        mspConnectionPairIds: ["long"],
        pinIds: ["p1", "p2"],
        pins: [] as any,
      },
      {
        mspPairId: "short",
        globalConnNetId: "net1",
        dcConnNetId: "net1",
        tracePath: [{ x: 5, y: 0 }, { x: 15, y: 0 }],
        mspConnectionPairIds: ["short"],
        pinIds: ["p3", "p4"],
        pins: [] as any,
      },
    ]
  
    const solver = new SameNetTraceMergeSolver({ traces })
    solver.solve()
    const output = solver.getOutput()
  
    expect(output.traces).toHaveLength(1)
    expect(output.traces[0].tracePath).toEqual([{ x: 0, y: 0 }, { x: 20, y: 0 }])
    expect(new Set(output.traces[0].mspConnectionPairIds)).toContain("long")
    expect(new Set(output.traces[0].mspConnectionPairIds)).toContain("short")
})

test("SameNetTraceMergeSolver - merge diagonal segments", () => {
    const traces: SolvedTracePath[] = [
      {
        mspPairId: "diag1",
        globalConnNetId: "net1",
        dcConnNetId: "net1",
        tracePath: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        mspConnectionPairIds: ["diag1"],
        pinIds: ["p1", "p2"],
        pins: [] as any,
      },
      {
        mspPairId: "diag2",
        globalConnNetId: "net1",
        dcConnNetId: "net1",
        tracePath: [
          { x: 5, y: 5 },
          { x: 15, y: 15 },
        ],
        mspConnectionPairIds: ["diag2"],
        pinIds: ["p2", "p3"],
        pins: [] as any,
      },
    ]
  
    const solver = new SameNetTraceMergeSolver({ traces })
    solver.solve()
    const output = solver.getOutput()
  
    expect(output.traces).toHaveLength(1)
    expect(output.traces[0].tracePath).toEqual([
      { x: 0, y: 0 },
      { x: 15, y: 15 },
    ])
})
