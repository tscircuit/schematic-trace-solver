import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-rp2040-h-bridge-vref-loop.input.json"

// Captured from imrishabh18/rp2040-motor-controller v1.0.55 using core 0.0.2285.
// Keep the H-bridge and its current-reference passives from the motor_driver
// sheet so the AVREF–BVREF wire still shares a net with the remote divider.
test("RP2040 motor controller H-bridge reference trace", async () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
  )
  solver.solve()
  expect(solver.solved).toBe(true)

  const output = solver.netLabelToTraceSolver!.getOutput()
  const referenceTrace = output.traces.find(
    (trace) =>
      trace.pinIds.includes("schematic_port_168") &&
      trace.pinIds.includes("schematic_port_169"),
  )
  expect(referenceTrace).toBeDefined()

  const { pins, tracePath } = referenceTrace!
  const pinY = Math.max(...pins.map((pin) => pin.y))
  const bridgeY = Math.max(...tracePath.map((point) => point.y))
  expect(bridgeY - pinY).toBeLessThanOrEqual(0.25)
  expect(
    [...output.netLabelPlacements, ...output.inlineNetLabelPlacements].some(
      (label) =>
        label.netLabelText === "DRV_VREF" &&
        tracePathContainsPoint(tracePath, label.anchorPoint),
    ),
  ).toBe(true)

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
