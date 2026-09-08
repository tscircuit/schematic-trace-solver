import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-unnecessary-junction-markers.input.json"

// Reduced from a Core schematic with several decoupling capacitors on shared
// power rails. The routed rails show junction dots at non-branching bends and
// endpoints around the capacitors, where no junction marker is needed.
test("reproduces unnecessary junction markers on non-branching routes", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
  )

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
