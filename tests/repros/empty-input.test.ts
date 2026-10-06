import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"

// Regression test for #657: the pipeline crashed with
// "Unexpected numItems value: 0" when given a problem with no chips, because
// ChipObstacleSpatialIndex built a zero-item Flatbush index.

const emptyProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

test("pipeline solves an empty problem without crashing", () => {
  const solver = new SchematicTracePipelineSolver(emptyProblem)
  expect(() => solver.solve()).not.toThrow()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
})

test("pipeline solves a problem with no connections but with chips", () => {
  const solver = new SchematicTracePipelineSolver({
    ...emptyProblem,
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 2,
        height: 2,
        pins: [{ pinId: "U1.1", x: 1, y: 0 }],
      },
    ],
  })
  expect(() => solver.solve()).not.toThrow()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
})
