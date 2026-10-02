import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputJson from "./assets/repro-rp2040-temperature-alarm.input.json"

// imrishabh18/rp2040-motor-controller v1.0.42, position_alarm / Temperature Alarm.
// Captured with @tscircuit/core 0.0.2032 after schematic layout/style refinement.
// Only BZ1, Q_BUZZER, D_BUZZER, R_BUZZER_GATE and R_BUZZER_PD are retained;
// cross-section connections retain their boundary net labels. Component IDs,
// symbol names and label text are annotated for readability; geometry is unchanged.
// BZ1._NEG and Q_BUZZER.D lie inside each other's expanded routing obstacles.
test("RP2040 Temperature Alarm leaves the buzzer bottom port as a net label", async () => {
  const solver = new SchematicTracePipelineSolver(
    structuredClone(inputJson) as unknown as InputProblem,
    { hideRatsNet: true },
  )
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  const buzzerNegative = "schematic_port_294"
  const transistorDrain = "schematic_port_299"
  const output = solver.netLabelToTraceSolver!.getOutput()
  expect(
    solver.schematicTraceLinesSolver!.failedConnectionPairs.some(
      (pair) =>
        pair.pins.some((pin) => pin.pinId === buzzerNegative) &&
        pair.pins.some((pin) => pin.pinId === transistorDrain),
    ),
  ).toBe(true)
  expect(
    output.traces.some((trace) => trace.pinIds.includes(buzzerNegative)),
  ).toBe(false)
  expect(
    output.netLabelPlacements.some(
      (label) =>
        label.pinIds.length === 1 && label.pinIds[0] === buzzerNegative,
    ),
  ).toBe(true)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
