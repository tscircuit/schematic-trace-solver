import type { InputProblem } from "lib/types/InputProblem"
import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 0.5,
      height: 0.5,
      pins: [
        {
          pinId: "U1.1",
          x: -1,
          y: 0,
        },
        {
          pinId: "U1.2",
          x: 0,
          y: 0,
        },
        {
          pinId: "U1.3",
          x: 1,
          y: 0,
        },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      pinIds: ["U1.1", "U1.2", "U1.3"],
      netId: "NET1",
    },
  ],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 2,
}

test("SchematicTracePipelineSolver should combine collinear trace segments", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  // Currently (Pre-fix) expected to have 2 traces: (-1,0)->(0,0) and (0,0)->(1,0)
  // After fix, should have 1 trace: (-1,0)->(1,0)

  // Check output of TraceCombineSolver
  const combinedTraces = solver.traceCombineSolver?.getOutput().traces ?? []

  if (combinedTraces.length > 0) {
    // Expect 1 consolidated trace for this problem.
    expect(combinedTraces.length).toBe(1)
  } else {
    expect(true).toBe(false)
  }

  // Verify that initially we had multiple segments (confirming the issue existed before this phase)
  const initialTraces = solver.schematicTraceLinesSolver!.solvedTracePaths
  expect(initialTraces.length).toBeGreaterThan(1)
})
