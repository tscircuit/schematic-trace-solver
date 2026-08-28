import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "./assets/repro-mac-hub-slow-pipeline.input.json"

const MAX_EXPECTED_SOLVE_TIME_MS = 10_000

test.skip("repro MAC_HUB pipeline exceeds the trace runtime budget", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)
  const startedAt = performance.now()

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(performance.now() - startedAt).toBeLessThan(MAX_EXPECTED_SOLVE_TIME_MS)
})
