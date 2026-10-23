import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-schematic-section-autolayout-no-section.input.json"

// Exact solver:started input from tscircuit/core at b198cb4116f55a10d5ce709c5c99ecb73799f41e:
// tests/components/primitive-components/schematic-section-autolayout-no-section.test.tsx.
test("repro schematic sections with unsectioned output components", async () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)
  solver.solve()
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
