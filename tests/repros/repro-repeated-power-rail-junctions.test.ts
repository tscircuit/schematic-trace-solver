import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-repeated-power-rail-junctions.input.json"

// Reduced from the DS1 area of a Core clock schematic. Three repeated
// controller/decoupling pairs are the minimum input that preserves the local
// rectangular branches and multiple junctions beside U_DS1 pins 2 and 3.
test("collapses repeated junctions around adjacent power rails", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
  )

  solver.solve()

  expect(solver.solved).toBe(true)
  // Earlier detour simplification leaves one cycle for junction alignment.
  expect(solver.sameNetJunctionAlignmentSolver?.stats.collapsedCycleCount).toBe(
    1,
  )
  expect(
    solver.sameNetJunctionAlignmentSolver?.stats.alignedJunctionCount,
  ).toBe(2)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
