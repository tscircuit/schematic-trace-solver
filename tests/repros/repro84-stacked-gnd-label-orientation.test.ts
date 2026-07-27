import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "TOP",
      center: { x: 0, y: 1.4 },
      width: 0.8,
      height: 1.4,
      pins: [
        {
          pinId: "TOP.GND",
          x: 0.2,
          y: 0.3,
          _facingDirection: "y-",
        },
      ],
    },
    {
      chipId: "BOTTOM",
      center: { x: 0, y: -1.5 },
      width: 0.8,
      height: 1.4,
      pins: [
        {
          pinId: "BOTTOM.GND",
          x: -0.2,
          y: -0.4,
          _facingDirection: "y+",
        },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "GND",
      pinIds: ["TOP.GND", "BOTTOM.GND"],
      netLabelWidth: 0.42,
      netLabelHeight: 0.48,
    },
  ],
  textBoxes: [],
  availableNetLabelOrientations: { GND: ["y-"] },
  maxMspPairDistance: 2.4,
}

test("repro84 restores GND orientation between stacked components", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const initialGndLabel = solver.netLabelPlacementSolver!.netLabelPlacements[0]
  const finalGndLabel =
    solver.netLabelNetLabelCollisionSolver!.getOutput().netLabelPlacements[0]
  const traces = solver.netLabelTraceCollisionSolver!.getOutput().traces

  expect(initialGndLabel?.orientation).toBe("x+")
  expect(finalGndLabel?.orientation).toBe("y-")
  expect(
    traces.some((trace) =>
      trace.mspPairId.startsWith("available-net-orientation"),
    ),
  ).toBe(true)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
