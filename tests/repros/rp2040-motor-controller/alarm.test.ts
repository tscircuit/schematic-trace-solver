import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputJson from "./assets/alarm.input.json"

// v1.0.40, sheet position_alarm, section alarm.
// Components: BZ1, Q_BUZZER, D_BUZZER, R_BUZZER_GATE, R_BUZZER_PD.
// This snapshot records current routing for a later schematic-quality fix.
test("RP2040 motor controller: alarm", async () => {
  const input = structuredClone(inputJson) as unknown as InputProblem
  const solver = new SchematicTracePipelineSolver(input)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
