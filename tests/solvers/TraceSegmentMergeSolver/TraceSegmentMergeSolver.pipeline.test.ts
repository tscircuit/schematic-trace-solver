import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("pipeline includes and solves the trace segment merge phase before label overlap avoidance", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1,
        pins: [
          { pinId: "U1.1", x: -0.5, y: 0.25 },
          { pinId: "U1.2", x: -0.5, y: -0.25 },
        ],
      },
      {
        chipId: "J1",
        center: { x: -2, y: 0 },
        width: 0.5,
        height: 1,
        pins: [
          { pinId: "J1.1", x: -2, y: 0.25 },
          { pinId: "J1.2", x: -2, y: -0.25 },
        ],
      },
    ],
    directConnections: [
      { pinIds: ["U1.1", "J1.1"], netId: "VCC" },
      { pinIds: ["U1.2", "J1.2"], netId: "GND" },
    ],
    netConnections: [
      { pinIds: ["U1.1", "J1.1"], netId: "VCC" },
      { pinIds: ["U1.2", "J1.2"], netId: "GND" },
    ],
    availableNetLabelOrientations: {
      VCC: ["y+"],
      GND: ["y-"],
    },
    maxMspPairDistance: 3,
  }

  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()
  const pipelineStepNames = solver.pipelineDef.map((step) => step.solverName)

  expect(solver.solved).toBe(true)
  expect(solver.traceSegmentMergeSolver?.solved).toBe(true)
  expect(pipelineStepNames.indexOf("traceSegmentMergeSolver")).toBeGreaterThan(
    pipelineStepNames.indexOf("traceOverlapShiftSolver"),
  )
  expect(pipelineStepNames.indexOf("traceSegmentMergeSolver")).toBeLessThan(
    pipelineStepNames.indexOf("traceLabelOverlapAvoidanceSolver"),
  )
})
