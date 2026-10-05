import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-trace-endpoints-stop-at-component-boundary.input.json"

const inputProblem: InputProblem = JSON.parse(JSON.stringify(inputProblemJson))

// F1 and RV1 have ports inside their text-expanded component bounds. The
// routed traces must leave those bounds on the original left-facing sides,
// rather than snapping to the nearer lower edges. The fixture supplies the
// previously expanded obstacle sizes explicitly, retaining symbol pin directions.
test("trace endpoints preserve symbol facing with supplied obstacle bounds", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem, {
    hideRatsNet: true,
  })

  solver.solve()

  expect(solver.schematicTraceLinesSolver!.solvedTracePaths).toHaveLength(2)
  for (const chipId of ["F1", "RV1"]) {
    const originalChip = inputProblem.chips.find(
      (chip) => chip.chipId === chipId,
    )!
    const correctedChip = solver.inputProblem.chips.find(
      (chip) => chip.chipId === chipId,
    )!
    for (const [pinIndex, pin] of correctedChip.pins.entries()) {
      const originalPin = originalChip.pins[pinIndex]!
      expect(pin._facingDirection).toBe(originalPin._facingDirection)
      expect(pin.y).toBe(originalPin.y)
    }
  }
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
