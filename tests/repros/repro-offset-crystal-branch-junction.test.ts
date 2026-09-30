import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-offset-crystal-branch-junction.input.json"

const solverInput: InputProblem = JSON.parse(JSON.stringify(inputProblem))

// Complete solver input captured from @tscircuit/core's crystal junction repro,
// with component names and symbols restored for a faithful snapshot.
test("repro crystal branch junction is offset from the branch", () => {
  const solver = new SchematicTracePipelineSolver(solverInput)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
