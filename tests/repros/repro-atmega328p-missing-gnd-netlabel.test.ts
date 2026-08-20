import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro-atmega328p-missing-gnd-netlabel.input.json"
import "tests/fixtures/matcher"

// Repro: GND pins U_MCU.3 and U_MCU.5 end up with no net label. The GND net is
// split into three MSP-paired islands; the {U_MCU.3, U_MCU.5} bracket is boxed
// in by the chip and the neighboring VCC bracket. The net's configured
// netLabelHeight (0.42) doesn't fit anywhere in that cramped island, so
// NetLabelPlacementSolver used to give up on the group entirely
// (failedGroups) instead of retrying at the default label size.
test("repro atmega328p missing gnd netlabel on interleaved pins", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  expect(solver.netLabelPlacementSolver!.failedGroups).toHaveLength(0)

  const gndLabel = solver.netLabelPlacementSolver!.netLabelPlacements.find(
    (label) =>
      label.pinIds.includes("U_MCU.3") && label.pinIds.includes("U_MCU.5"),
  )
  expect(gndLabel).toBeDefined()
  expect(gndLabel!.netId).toBe("GND")

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
