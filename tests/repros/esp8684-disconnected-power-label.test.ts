import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "./assets/esp8684-disconnected-power-label.input.json"
import "tests/fixtures/matcher"

// Captured from core's esp8684-disconnected-power-label.test.tsx.
// The isolated MCU section does not reproduce the disconnected V3V3 label.
test("ESP8684 V3V3 label stays connected when the MCU power bus moves", () => {
  const problem: InputProblem = JSON.parse(JSON.stringify(inputProblem))
  const solver = new SchematicTracePipelineSolver(problem)
  solver.solve()
  const output = solver.inlineNetLabelSolver!.getOutput()
  const mcu = problem.chips.find((chip) =>
    chip.pins.some((pin) => pin.displayName === "VDD3P3_CPU"),
  )!
  const cpuPin = mcu.pins.find((pin) => pin.displayName === "VDD3P3_CPU")!
  const label = output.netLabelPlacements.find(
    (label) =>
      label.netId === "V3V3" &&
      label.pinIds.some((pinId) => mcu.pins.some((pin) => pin.pinId === pinId)),
  )!
  const connector = output.traces.find(
    (trace) =>
      output.netLabelConnectorTraceIds!.has(trace.mspPairId) &&
      trace.globalConnNetId === label.globalConnNetId &&
      trace.pinIds.some((pinId) => label.pinIds.includes(pinId)),
  )!
  expect(cpuPin.x - connector.tracePath[0].x).toBeCloseTo(0.1)
  expect(
    output.traces.some(
      (trace) =>
        trace !== connector &&
        trace.globalConnNetId === connector.globalConnNetId &&
        tracePathContainsPoint(trace.tracePath, connector.tracePath[0]),
    ),
  ).toBe(true)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
