import { test, expect } from "bun:test"
import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

test("SameNetTraceMergeSolver - merges collinear segments with small gap", () => {
  const inputProblem: InputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }

  const trace1: SolvedTracePath = {
    mspPairId: "pair1",
    globalConnNetId: "net1",
    tracePath: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
    mspConnectionPairIds: ["pair1"],
    pinIds: ["pin1", "pin2"],
    pins: [] as any,
  }

  const trace2: SolvedTracePath = {
    mspPairId: "pair2",
    globalConnNetId: "net1",
    tracePath: [
      { x: 1.02, y: 0 },
      { x: 2, y: 0 },
    ],
    mspConnectionPairIds: ["pair2"],
    pinIds: ["pin3", "pin4"],
    pins: [] as any,
  }

  const solver = new SameNetTraceMergeSolver({
    inputProblem,
    inputTraceMap: {
      pair1: trace1,
      pair2: trace2,
    },
    gapThreshold: 0.05,
  })

  solver.solve()
  const output = solver.getOutput()
  const mergedTraces = Object.values(output.correctedTraceMap)

  expect(mergedTraces.length).toBe(1)
  expect(mergedTraces[0].tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ])
  expect(mergedTraces[0].mspConnectionPairIds).toContain("pair1")
  expect(mergedTraces[0].mspConnectionPairIds).toContain("pair2")
})

test("SameNetTraceMergeSolver - does not merge segments of different nets", () => {
  const inputProblem: InputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }

  const trace1: SolvedTracePath = {
    mspPairId: "pair1",
    globalConnNetId: "net1",
    tracePath: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
    mspConnectionPairIds: ["pair1"],
    pinIds: ["pin1", "pin2"],
    pins: [] as any,
  }

  const trace2: SolvedTracePath = {
    mspPairId: "pair2",
    globalConnNetId: "net2",
    tracePath: [
      { x: 1.02, y: 0 },
      { x: 2, y: 0 },
    ],
    mspConnectionPairIds: ["pair2"],
    pinIds: ["pin3", "pin4"],
    pins: [] as any,
  }

  const solver = new SameNetTraceMergeSolver({
    inputProblem,
    inputTraceMap: {
      pair1: trace1,
      pair2: trace2,
    },
  })

  solver.solve()
  const output = solver.getOutput()
  const mergedTraces = Object.values(output.correctedTraceMap)

  expect(mergedTraces.length).toBe(2)
})
