import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { TraceSegmentCombinerSolver } from "lib/solvers/TraceSegmentCombinerSolver/TraceSegmentCombinerSolver"

test("TraceSegmentCombinerSolver - combines parallel close segments", () => {
  const allTraces: SolvedTracePath[] = [
    {
      mspPairId: "trace1",
      globalConnNetId: "NET1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      pins: [] as any,
      dcConnNetId: "NET1",
      mspConnectionPairIds: ["trace1"],
      pinIds: ["P1", "P3"],
    },
    {
      mspPairId: "trace2",
      globalConnNetId: "NET1",
      tracePath: [
        { x: 0, y: 0.05 },
        { x: 10, y: 0.05 },
      ],
      pins: [] as any,
      dcConnNetId: "NET1",
      mspConnectionPairIds: ["trace2"],
      pinIds: ["P2", "P4"],
    },
  ]

  const solver = new TraceSegmentCombinerSolver({
    inputProblem: {
      chips: [],
      directConnections: [],
      netConnections: [],
      availableNetLabelOrientations: {},
    },
    allTraces,
  })

  solver.step()
  const output = solver.getOutput().traces

  expect(output[1].tracePath[0].y).toBe(0)
  expect(output[1].tracePath[1].y).toBe(0)
})

test("TraceSegmentCombinerSolver - does not combine different nets", () => {
  const allTraces: SolvedTracePath[] = [
    {
      mspPairId: "trace1",
      globalConnNetId: "NET1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      pins: [] as any,
      dcConnNetId: "NET1",
      mspConnectionPairIds: ["trace1"],
      pinIds: ["P1", "P3"],
    },
    {
      mspPairId: "trace2",
      globalConnNetId: "NET2",
      tracePath: [
        { x: 0, y: 0.05 },
        { x: 10, y: 0.05 },
      ],
      pins: [] as any,
      dcConnNetId: "NET2",
      mspConnectionPairIds: ["trace2"],
      pinIds: ["P2", "P4"],
    },
  ]

  const solver = new TraceSegmentCombinerSolver({
    inputProblem: {
      chips: [],
      directConnections: [],
      netConnections: [],
      availableNetLabelOrientations: {},
    },
    allTraces,
  })

  solver.step()
  const output = solver.getOutput().traces

  expect(output[1].tracePath[0].y).toBe(0.05)
})
