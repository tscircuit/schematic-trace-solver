import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("pipeline does not stretch a real loop toward a generated label connector", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U3",
        center: { x: 0, y: 0 },
        width: 2.8,
        height: 1.4,
        pins: [
          { pinId: "U3.3", x: 1.4, y: -0.3 },
          { pinId: "U3.7", x: 1.4, y: -0.5 },
        ],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "V3_3",
        pinIds: ["U3.3", "U3.7"],
        netLabelWidth: 0.42,
        netLabelHeight: 0.6,
      },
    ],
    textBoxes: [],
    availableNetLabelOrientations: { V3_3: ["y+"] },
    maxMspPairDistance: 2.4,
  }
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const traces = solver.traceCleanupSolver2!.getOutput().traces
  const realTrace = traces.find((trace) => trace.mspPairId === "U3.3-U3.7")!
  const labelConnector = traces.find((trace) =>
    trace.mspPairId.startsWith("available-net-orientation-"),
  )!
  expect(realTrace.tracePath).toEqual([
    { x: 1.4, y: -0.3 },
    { x: 1.5999999999999999, y: -0.3 },
    { x: 1.5999999999999999, y: -0.5 },
    { x: 1.4, y: -0.5 },
  ])
  expect(labelConnector.mspPairId).toBe("available-net-orientation-0-V3_3")
  expect(solver.traceCleanupSolver2!.stats).toMatchObject({
    alignedRailGroupCount: 0,
    alignedTraceCount: 0,
  })
})
