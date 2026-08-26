import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-board-648-esp12f-section.input.json"

test("board 648 ESP-12F power and boot section", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)

  solver.solve()

  expect(
    solver.sameNetJunctionAlignmentSolver?.stats.collapsedDetourCount,
  ).toBe(0)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
