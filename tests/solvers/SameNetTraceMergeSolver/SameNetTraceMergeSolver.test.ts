import { test, expect } from "bun:test"
import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

function makeTrace(
  id: string,
  netId: string,
  path: Array<{ x: number; y: number }>,
): SolvedTracePath {
  return {
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    pins: [
      { pinId: "p1", x: path[0]!.x, y: path[0]!.y, chipId: "C1" },
      {
        pinId: "p2",
        x: path[path.length - 1]!.x,
        y: path[path.length - 1]!.y,
        chipId: "C2",
      },
    ] as any,
    tracePath: path,
    mspConnectionPairIds: [id],
    pinIds: ["p1", "p2"],
  }
}

test("merges parallel horizontal segments on the same net within gap threshold", () => {
  const traces = [
    makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
    ]),
    makeTrace("t2", "net1", [
      { x: 0, y: 0.1 },
      { x: 2, y: 0.1 },
      { x: 2, y: -1 },
    ]),
  ]

  const solver = new SameNetTraceMergeSolver({
    inputProblem,
    inputTraces: traces,
  })
  solver.solve()
  expect(solver.solved).toBe(true)

  const output = solver.getOutput()
  const t1y = output.traces[0]!.tracePath[0]!.y
  const t2y = output.traces[1]!.tracePath[0]!.y

  expect(t1y).toBe(t2y)
  expect(t1y).toBeCloseTo(0.05, 5)
})

test("does not merge segments from different nets", () => {
  const traces = [
    makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]),
    makeTrace("t2", "net2", [
      { x: 0, y: 0.1 },
      { x: 2, y: 0.1 },
    ]),
  ]

  const solver = new SameNetTraceMergeSolver({
    inputProblem,
    inputTraces: traces,
  })
  solver.solve()

  const output = solver.getOutput()
  expect(output.traces[0]!.tracePath[0]!.y).toBe(0)
  expect(output.traces[1]!.tracePath[0]!.y).toBe(0.1)
})

test("does not merge segments that are far apart", () => {
  const traces = [
    makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]),
    makeTrace("t2", "net1", [
      { x: 0, y: 1 },
      { x: 2, y: 1 },
    ]),
  ]

  const solver = new SameNetTraceMergeSolver({
    inputProblem,
    inputTraces: traces,
  })
  solver.solve()

  const output = solver.getOutput()
  expect(output.traces[0]!.tracePath[0]!.y).toBe(0)
  expect(output.traces[1]!.tracePath[0]!.y).toBe(1)
})

test("merges parallel vertical segments on the same net", () => {
  const traces = [
    makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 2 },
    ]),
    makeTrace("t2", "net1", [
      { x: 0.1, y: 0 },
      { x: 0.1, y: 2 },
    ]),
  ]

  const solver = new SameNetTraceMergeSolver({
    inputProblem,
    inputTraces: traces,
  })
  solver.solve()

  const output = solver.getOutput()
  const t1x = output.traces[0]!.tracePath[0]!.x
  const t2x = output.traces[1]!.tracePath[0]!.x

  expect(t1x).toBe(t2x)
  expect(t1x).toBeCloseTo(0.05, 5)
})

test("handles traces with no close parallel segments gracefully", () => {
  const traces = [
    makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]),
  ]

  const solver = new SameNetTraceMergeSolver({
    inputProblem,
    inputTraces: traces,
  })
  solver.solve()

  const output = solver.getOutput()
  expect(output.traces[0]!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ])
})

test("works with full pipeline integration", () => {
  const { SchematicTracePipelineSolver } = require("lib/index")

  const problem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 1.6,
        height: 0.6,
        pins: [
          { pinId: "U1.1", x: -0.8, y: 0.2 },
          { pinId: "U1.2", x: -0.8, y: -0.2 },
          { pinId: "U1.3", x: 0.8, y: -0.2 },
          { pinId: "U1.4", x: 0.8, y: 0.2 },
        ],
      },
      {
        chipId: "C1",
        center: { x: -2, y: 0 },
        width: 0.5,
        height: 1,
        pins: [
          { pinId: "C1.1", x: -2, y: 0.5 },
          { pinId: "C1.2", x: -2, y: -0.5 },
        ],
      },
    ],
    directConnections: [
      { pinIds: ["U1.1", "C1.1"], netId: "VCC" },
      { pinIds: ["U1.2", "C1.2"], netId: "GND" },
    ],
    netConnections: [],
    availableNetLabelOrientations: {
      VCC: ["y+"],
      GND: ["y-"],
    },
  }

  const solver = new SchematicTracePipelineSolver(problem)
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.sameNetTraceMergeSolver).toBeDefined()
  expect(solver.sameNetTraceMergeSolver!.solved).toBe(true)
})
