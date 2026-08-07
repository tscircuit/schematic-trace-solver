import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "../assets/repro-u7-boot-gate-overlap.input.json"
import "tests/fixtures/matcher"

test("reproduces overlapping U7 BOOT_GATE branches", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
