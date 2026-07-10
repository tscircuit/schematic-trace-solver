import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/small-variant-resistor-facing-direction.input.json"
import "tests/fixtures/matcher"

// Regression for a small-variant resistor (R_FAULT_PULLUP) whose wide
// reference-designator text inflates its chip box, so its two ports sit *inside*
// the box rather than on an edge.
//
// The input supplies each port's facing direction (as @tscircuit/core does from
// the schematic symbol). The solver must snap such inside-pins to the box edge
// ALONG that facing (correctPinsInsideChips) instead of guessing the nearest
// edge — which, for a horizontal resistor whose ref text widened the box, is the
// bottom edge, wrongly making both terminals face "y-" and routing downward.
test("small-variant resistor with facing directions routes from the sides", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const resistor = solver.inputProblem.chips.find(
    (c) => c.chipId === "schematic_component_1",
  )!
  // Terminals keep their symbol-provided facing instead of being re-detected as
  // facing down, and are snapped to the left/right edges of the inflated box.
  expect(resistor.pins.map((p) => p._facingDirection).sort()).toEqual([
    "x+",
    "x-",
  ])
  const left = resistor.pins.find((p) => p._facingDirection === "x-")!
  const right = resistor.pins.find((p) => p._facingDirection === "x+")!
  expect(left.x).toBeCloseTo(resistor.center.x - resistor.width / 2)
  expect(right.x).toBeCloseTo(resistor.center.x + resistor.width / 2)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
