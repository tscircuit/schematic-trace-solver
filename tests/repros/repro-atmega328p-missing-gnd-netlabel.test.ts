import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro-atmega328p-missing-gnd-netlabel.input.json"
import "tests/fixtures/matcher"

// Repro: GND pins U_MCU.3 and U_MCU.5 end up with no net label. The GND net is
// split into three MSP-paired islands; the {U_MCU.3, U_MCU.5} bracket is boxed
// in by the chip and the neighboring VCC bracket, so NetLabelPlacementSolver
// cannot place its label and silently drops the group (failedGroups), leaving
// those pins visually unlabeled.
test("repro atmega328p missing gnd netlabel on interleaved pins", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
