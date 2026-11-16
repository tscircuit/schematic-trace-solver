import { expect, test } from "bun:test"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "./assets/repro-555-threshold-trigger-inline-label.input.json"

// Captured from Core's schematic-section-2 test. Nearby traces reduce the
// usable length of the horizontal leg below the total length of the wire.
test("keeps the 555 THRES–TRIG loop long enough for its inline label", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
  )
  solver.solve()
  const output = solver.netLabelToTraceSolver!.getOutput()
  const loop = output.traces.find(
    ({ pinIds }) =>
      pinIds.includes("schematic_port_7") &&
      pinIds.includes("schematic_port_11"),
  )!
  const pinX = loop.tracePath[0]!.x
  const elbowX = Math.min(...loop.tracePath.map(({ x }) => x))
  expect(pinX - elbowX).toBeCloseTo(1.18)

  const label = output.inlineNetLabelPlacements.find(
    (placement) =>
      placement.mspPairId === loop.mspPairId &&
      placement.netLabelText === "THRES_TRIG",
  )!
  expect(label.axis).toBe("x")
  expect(label.stubTracePath).toBeUndefined()
  expect(tracePathContainsPoint(loop.tracePath, label.anchorPoint)).toBe(true)
})
