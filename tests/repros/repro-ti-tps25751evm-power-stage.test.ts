import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-ti-tps25751evm-power-stage.input.json"

// Captured from the power-stage sheet of the TI TPS25751EVM reference
// schematic (tscircuit/checks tests/reference-schematics) using core 0.0.2430.
test("TI TPS25751EVM power-stage sheet", async () => {
  const problem = inputProblem as unknown as InputProblem
  const solver = new SchematicTracePipelineSolver(problem)
  solver.solve()
  expect(solver.solved).toBe(true)

  // U10 ties its NC pins into one ground rail on the left side, and BIAS,
  // AGND, PGND, and PAD into one on the right side. Each rail's ground symbol
  // should hang from the rail's lower end (pin 30 and PAD), not from a stub.
  const output = solver.inlineNetLabelSolver!.getOutput()
  const u10 = problem.chips.find((chip) =>
    chip.pins.some((pin) => pin.displayName === "CBOOT"),
  )!
  const u10PinIds = new Set(u10.pins.map((pin) => pin.pinId))
  const groundLabels = output.netLabelPlacements.filter(
    (label) =>
      label.netId === "GND" &&
      label.pinIds.some((pinId) => u10PinIds.has(pinId)),
  )
  expect(groundLabels).toHaveLength(2)

  for (const label of groundLabels) {
    expect(label.orientation).toBe("y-")
    const rail = output.traces.filter(
      (trace) =>
        trace.globalConnNetId === label.globalConnNetId &&
        !output.netLabelConnectorTraceIds!.has(trace.mspPairId) &&
        trace.pins.every(
          (pin) =>
            pin.chipId === u10.chipId &&
            Math.sign(pin.x - u10.center.x) ===
              Math.sign(label.anchorPoint.x - u10.center.x),
        ),
    )
    expect(
      rail.some((trace) =>
        tracePathContainsPoint(trace.tracePath, label.anchorPoint),
      ),
    ).toBe(true)
    const railBottomY = Math.min(
      ...rail.flatMap((trace) => trace.tracePath.map((point) => point.y)),
    )
    expect(label.anchorPoint.y).toBeCloseTo(railBottomY)
    expect(
      output.traces.some(
        (trace) =>
          output.netLabelConnectorTraceIds!.has(trace.mspPairId) &&
          tracePathContainsPoint(trace.tracePath, label.anchorPoint),
      ),
    ).toBe(false)
  }

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
