import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import input from "./assets/repro-rp2040-nema23-controller.input.json"

// Unmodified solver:started event.solverParams for the complete controller sheet:
// https://tscircuit.com/seveibar/rp2040-nema23-stepper-motor-controller#schematic
// Release 0.1.1: 6b3025cf-5ddf-456e-8edb-12028f05a514.
// Rendered the original board source with its frozen bun.lock: core 0.0.1914,
// schematic-trace-solver 0.0.196. PCB rendering is disabled as in the board's
// render-schematic script. No geometry, connections, or display data is edited.
// Solver 0.0.196 produces the reported dangling V3V3 connector. Solver 0.0.204
// keeps the label attached; this full-sheet snapshot records the current output.
test("repro RP2040 NEMA23 complete controller sheet", async () => {
  const solver = new SchematicTracePipelineSolver(
    structuredClone(input) as unknown as InputProblem,
    { hideRatsNet: true },
  )
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
