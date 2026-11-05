import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro-kicad-bga381-inline-refinement.input.json"
import type { InputProblem } from "lib/types/InputProblem"

// MIT-licensed ECP5 BGA381 schematic, captured from dataset-tsx35-kicad-boards.
// https://github.com/gildobjanschi/ECP5_BGA381_FT2232HQ_FIFO_EXT
// Original passive symbol names are retained for visualization.
// A fixed iteration budget captures stalled refinement without hanging the test.
test("snapshots dense inline label refinement within the iteration budget", async () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as InputProblem,
    { hideRatsNet: true },
  )
  while (!solver.solved && !solver.failed && solver.iterations < 10000) {
    solver.step()
  }
  expect(solver.error).toBeNull()
  expect(solver.failed).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
}, 120000)
