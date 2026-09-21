import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import input from "./assets/repro-am3352-06-boot.input.json"


// Full sheet from am3352-dev-board-4layer-dogbone.json; routing uses core defaults.
test("repro complete AM3352 06-Boot sheet", async () => {
  const problem = structuredClone(input) as InputProblem
  const solver = new SchematicTracePipelineSolver(problem, {
    hideRatsNet: true,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
