import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-board-8090-power-section.input.json"

// Isolated from board 8090's power section: battery and solar inputs,
// BAT54S selection, MCP1700 regulation, and the three local support components.
test("board 8090 power section routing", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)

  solver.solve()

  expect(
    solver.sameNetJunctionAlignmentSolver?.stats.alignedJunctionCount,
  ).toBe(1)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
