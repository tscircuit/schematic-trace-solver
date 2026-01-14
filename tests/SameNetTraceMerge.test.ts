import { test, expect } from "bun:test"
import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const closeParallelTraces: SolvedTracePath[] = [
  {
    mspPairId: "trace-1",
    dcConnNetId: "NET1",
    globalConnNetId: "NET1",
    userNetId: "NET1",
    pins: [
      { pinId: "A1", chipId: "C1", x: 0, y: 0 },
      { pinId: "B1", chipId: "C2", x: 2, y: 0 },
    ],
    tracePath: [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ],
    mspConnectionPairIds: ["trace-1"],
    pinIds: ["A1", "B1"],
  },
  {
    mspPairId: "trace-2",
    dcConnNetId: "NET1",
    globalConnNetId: "NET1",
    userNetId: "NET1",
    pins: [
      { pinId: "A2", chipId: "C3", x: 0, y: 0.005 },
      { pinId: "B2", chipId: "C4", x: 2, y: 0.005 },
    ],
    tracePath: [
      { x: 0, y: 0.005 },
      { x: 2, y: 0.005 },
    ],
    mspConnectionPairIds: ["trace-2"],
    pinIds: ["A2", "B2"],
  },
]

const tracesCrossingBox: SolvedTracePath[] = [
  {
    mspPairId: "trace-1",
    dcConnNetId: "NET_BOX",
    globalConnNetId: "NET_BOX",
    userNetId: "NET_BOX",
    pins: [
      { pinId: "A1", chipId: "C1", x: -2, y: 0 },
      { pinId: "B1", chipId: "C2", x: 0.5, y: 0 },
    ],
    tracePath: [
      { x: -2, y: 0 },
      { x: 0.5, y: 0 },
    ],
    mspConnectionPairIds: ["trace-1"],
    pinIds: ["A1", "B1"],
  },
  {
    mspPairId: "trace-2",
    dcConnNetId: "NET_BOX",
    globalConnNetId: "NET_BOX",
    userNetId: "NET_BOX",
    pins: [
      { pinId: "A2", chipId: "C3", x: -0.5, y: 0 },
      { pinId: "B2", chipId: "C4", x: 2, y: 0 },
    ],
    tracePath: [
      { x: -0.5, y: 0 },
      { x: 2, y: 0 },
    ],
    mspConnectionPairIds: ["trace-2"],
    pinIds: ["A2", "B2"],
  },
]

test("merges close parallel segments on the same net", () => {
  const solver = new SameNetTraceMergeSolver({ traces: closeParallelTraces })

  solver.solve()

  const output = solver.getOutput()
  const net1Traces = output.traces.filter(
    (trace) => trace.globalConnNetId === "NET1",
  )

  expect(net1Traces.length).toBe(1)
  expect(net1Traces[0].mspConnectionPairIds.sort()).toEqual([
    "trace-1",
    "trace-2",
  ])
  expect(net1Traces[0].pinIds.sort()).toEqual(["A1", "A2", "B1", "B2"])
})

test("does not merge if merged path would intersect a component box", () => {
  const solver = new SameNetTraceMergeSolver({
    traces: tracesCrossingBox,
    componentBoxes: [
      {
        center: { x: 0, y: 0 },
        width: 0.5,
        height: 0.5,
      },
    ],
  })

  const info = (solver as any).findMergeInfo(
    tracesCrossingBox[0],
    tracesCrossingBox[1],
  ) as { orientation: "horizontal" | "vertical"; anchorCoord: number } | null

  expect(info).not.toBeNull()
  if (!info) throw new Error("merge info unexpectedly null")

  const merged = (solver as any).tryMergeTracePair(
    tracesCrossingBox[0],
    tracesCrossingBox[1],
    info,
  ) as SolvedTracePath | null

  expect(merged).toBeNull()

  solver.solve()
  const netBoxTraces = solver
    .getOutput()
    .traces.filter((trace) => trace.globalConnNetId === "NET_BOX")

  expect(netBoxTraces.length).toBe(2)
})
