import { readFileSync } from "fs"
import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"
import type { InputProblem } from "lib/types/InputProblem"

const fixturePath = new URL(
  "../../assets/repro32-castellated-pinout.schematicTraceSolverInput.json",
  import.meta.url,
)

const inputProblem = JSON.parse(
  readFileSync(fixturePath, "utf-8"),
) as InputProblem

test("pipeline completes for castellated pinout with limited overlap retries", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  expect(solver.failed).toBeFalse()
  expect(solver.solved).toBeTrue()
})
