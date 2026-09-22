import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import input from "./assets/repro-rp2040-nema23-controller.input.json"

// Unmodified solver:started event.solverParams for the complete controller sheet:
// https://tscircuit.com/seveibar/rp2040-nema23-stepper-motor-controller#schematic
// Release 0.1.1: 6b3025cf-5ddf-456e-8edb-12028f05a514.
// Captured using core 0.0.1959 (d8d83c8) and schematic-trace-solver 0.0.204;
// the solver's production source matches main at 3f06b4e. PCB rendering is
// disabled as in the board's render-schematic script. The board source and
// captured geometry, connections, and display data are unmodified.
// The reported dangling V3V3 connector does not reproduce on these commits;
// this snapshot records the complete controller sheet's current output.
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
