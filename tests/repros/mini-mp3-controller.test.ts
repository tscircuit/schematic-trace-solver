import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import input from "../assets/mini-mp3-controller.input.json"
import "tests/fixtures/matcher"

// Derived from mini-mp3-player.json's controller sheet (32 components, 96 pins).
// Retains exported symbol bounds, port positions/directions, source connectivity,
// and rail flags. Label dimensions follow Core's default text/rail sizing.
// This is not the original Core debug input: text-expanded obstacles and
// original routing/inline-label settings are unavailable in completed JSON.
test("mini mp3 player controller sheet routing", async () => {
  const solver = new SchematicTracePipelineSolver(input as unknown as InputProblem)
  solver.solve()
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
