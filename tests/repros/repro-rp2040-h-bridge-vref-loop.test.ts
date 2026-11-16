import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-rp2040-h-bridge-vref-loop.input.json"

// Captured from imrishabh18/rp2040-motor-controller v1.0.55 using core 0.0.2285.
// Keep the H-bridge and its current-reference passives from the motor_driver
// sheet so the AVREF–BVREF wire still shares a net with the remote divider.
test("RP2040 motor controller H-bridge reference trace", async () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)
  solver.solve()
  expect(solver.solved).toBe(true)

  const output = solver.netLabelToTraceSolver!.getOutput()
  const referenceTrace = output.traces.find(
    (trace) =>
      trace.pinIds.includes("schematic_port_168") &&
      trace.pinIds.includes("schematic_port_169"),
  )
  expect(referenceTrace).toBeDefined()

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
