import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputJson from "./assets/repro-rp2040-temperature-alarm.input.json"

// imrishabh18/rp2040-motor-controller v1.0.42, position_alarm / Temperature Alarm.
// Raw input captured with @tscircuit/core 0.0.2032 after layout/style refinement,
// before solver normalization (debug:logOutput, not solver:started).
// Only BZ1, Q_BUZZER, D_BUZZER, R_BUZZER_GATE and R_BUZZER_PD are retained;
// cross-section connections retain their boundary net labels. Component IDs,
// symbol names and label text are annotated for readability; geometry is unchanged.
// The drawn obstacle bounds in the raw core input are authoritative.
test("RP2040 Temperature Alarm connects the buzzer bottom port with a trace", async () => {
  const input = structuredClone(inputJson) as unknown as InputProblem
  const solver = new SchematicTracePipelineSolver(input, { hideRatsNet: true })
  const original = structuredClone(input)
  solver.solve()

  expect(input).toEqual(original)
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  for (const chip of input.chips.filter((chip) =>
    ["BZ1", "Q_BUZZER"].includes(chip.chipId),
  )) {
    expect(
      solver.inputProblem.chips.find(
        (normalized) => normalized.chipId === chip.chipId,
      ),
    ).toEqual(chip)
  }
  const buzzerNegative = "schematic_port_294"
  const transistorDrain = "schematic_port_299"
  const output = solver.netLabelToTraceSolver!.getOutput()
  const buzzerTrace = output.traces.find(
    (trace) =>
      trace.pinIds.includes(buzzerNegative) &&
      trace.pinIds.includes(transistorDrain),
  )
  expect(buzzerTrace).toBeDefined()
  for (const pinId of [buzzerNegative, transistorDrain]) {
    const pin = input.chips
      .flatMap((chip) => chip.pins)
      .find((pin) => pin.pinId === pinId)!
    expect(
      [buzzerTrace!.tracePath[0]!, buzzerTrace!.tracePath.at(-1)!].some(
        (point) =>
          Math.abs(point.x - pin.x) < 1e-9 && Math.abs(point.y - pin.y) < 1e-9,
      ),
    ).toBe(true)
  }
  for (let i = 1; i < buzzerTrace!.tracePath.length; i++) {
    const previous = buzzerTrace!.tracePath[i - 1]!
    const point = buzzerTrace!.tracePath[i]!
    expect(
      Math.abs(point.x - previous.x) < 1e-9 ||
        Math.abs(point.y - previous.y) < 1e-9,
    ).toBe(true)
  }
  expect(
    output.netLabelPlacements.some(
      (label) =>
        label.pinIds.length === 1 && label.pinIds[0] === buzzerNegative,
    ),
  ).toBe(false)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
