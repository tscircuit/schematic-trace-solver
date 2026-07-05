import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 1.3,
      height: 0.6,
      pins: [
        { pinId: "U1.3", x: 1.05, y: -0.1 },
        { pinId: "U1.4", x: 1.05, y: 0.1 },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "GND",
      pinIds: ["U1.3", "U1.4"],
      netLabelWidth: 0.48,
    },
  ],
  textBoxes: [
    {
      chipId: "U1",
      center: { x: 0.79, y: -0.43 },
      width: 2.88,
      height: 0.18,
      text: "SOMETHING_THAT_IS_LONG",
    },
  ],
  availableNetLabelOrientations: {
    GND: ["y-"],
  },
  maxMspPairDistance: 2.4,
}

test("repro142 manufacturer text overlaps GND net label", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  const output = solver.netLabelNetLabelCollisionSolver!.getOutput()
  const gndLabels = output.netLabelPlacements.filter(
    (label) => label.netId === "GND",
  )

  expect(gndLabels).toHaveLength(1)
  expect(solver.netLabelTraceCollisionSolver!.getOutput().traces).toHaveLength(
    1,
  )

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
