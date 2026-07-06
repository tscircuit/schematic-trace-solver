import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

// Mirrors tscircuit/core repro61 (tscircuit/core#1503): two capacitors whose
// pins are joined exclusively through net labels. The components must not be
// hard-wired together with a trace — each pin gets its own net label instead.
// https://github.com/tscircuit/schematic-trace-solver/issues/79
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_0", // C1
      center: { x: 2, y: 0 },
      width: 0.53,
      height: 1.1,
      pins: [
        { pinId: "C1.1", x: 2, y: -0.55 },
        { pinId: "C1.2", x: 2, y: 0.55 },
      ],
    },
    {
      chipId: "schematic_component_1", // C2
      center: { x: 0, y: 0 },
      width: 0.53,
      height: 1.1,
      pins: [
        { pinId: "C2.1", x: 0, y: -0.55 },
        { pinId: "C2.2", x: 0, y: 0.55 },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    { netId: "GND", pinIds: ["C1.1", "C2.1"], netLabelWidth: 0.31 },
    { netId: "VCC", pinIds: ["C1.2", "C2.2"], netLabelWidth: 0.29 },
  ],
  availableNetLabelOrientations: {
    GND: ["y-"],
    VCC: ["y+"],
  },
  maxMspPairDistance: 2.4,
}

test("repro61 net-label-only passive nets are not hard-wired together", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  // No traces between the two capacitors
  expect(solver.netLabelTraceCollisionSolver!.getOutput().traces).toHaveLength(
    0,
  )

  // Every pin gets its own net label
  const placements =
    solver.netLabelNetLabelCollisionSolver!.getOutput().netLabelPlacements
  expect(placements).toHaveLength(4)
  for (const placement of placements) {
    expect(placement.pinIds).toHaveLength(1)
  }
  expect(
    placements.filter((p) => p.netId === "GND").map((p) => p.pinIds[0]).sort(),
  ).toEqual(["C1.1", "C2.1"])
  expect(
    placements.filter((p) => p.netId === "VCC").map((p) => p.pinIds[0]).sort(),
  ).toEqual(["C1.2", "C2.2"])

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
