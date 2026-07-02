import type { InputProblem } from "lib/types/InputProblem"
import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"

test("repro61: net-label-only connections should not produce traces", () => {
  const inputProblem: InputProblem = {
    chips: [
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
      {
        chipId: "C2",
        center: { x: 2, y: 0 },
        width: 0.5,
        height: 1,
        pins: [
          { pinId: "C2.1", x: 2, y: 0.5 },
          { pinId: "C2.2", x: 2, y: -0.5 },
        ],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        pinIds: ["C1.1", "C2.1"],
        netId: "VCC",
      },
      {
        pinIds: ["C1.2", "C2.2"],
        netId: "GND",
      },
    ],
    availableNetLabelOrientations: {
      VCC: ["y+"],
      GND: ["y-"],
    },
  }

  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  // Verify that no schematic trace lines were solved/produced
  expect(solver.schematicTraceLinesSolver!.solvedTracePaths.length).toBe(0)
  if (solver.longDistancePairSolver) {
    expect(solver.longDistancePairSolver.solvedLongDistanceTraces.length).toBe(
      0,
    )
  }
})
