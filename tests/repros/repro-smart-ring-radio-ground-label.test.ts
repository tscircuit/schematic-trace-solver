import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { pathIntersectsRenderedLabel } from "lib/utils/pathIntersectsRenderedLabel"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-smart-ring-radio-ground-label.input.json"

test("smart-ring Radio pin 49 GND label stops above the pin 45 trace", async () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    { hideRatsNet: true },
  )
  solver.solve()
  expect(solver.solved).toBe(true)

  const { traces, netLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()
  const groundLabel = netLabelPlacements.find(
    (label) =>
      label.netId === "GND" && label.pinIds.includes("schematic_port_169"),
  )!
  const groundTrace = traces.find(
    (trace) =>
      trace.pinIds.includes("schematic_port_151") &&
      trace.pinIds.includes("schematic_port_165"),
  )!

  // The whole symbol must clear pin 45's horizontal wire from above.
  expect(pathIntersectsRenderedLabel(groundTrace.tracePath, groundLabel)).toBe(
    false,
  )
  const pin45 = inputProblem.chips[0]!.pins.find(
    (pin) => pin.pinId === "schematic_port_165",
  )!
  expect(groundLabel.center.y - groundLabel.height / 2).toBeGreaterThan(pin45.y)
  const connector = traces.find(
    (trace) =>
      solver.availableNetOrientationSolver!.netLabelConnectorTraceIds.has(
        trace.mspPairId,
      ) && trace.pinIds.includes("schematic_port_169"),
  )!
  expect(connector.tracePath.at(-1)).toEqual(groundLabel.anchorPoint)
  expect(Math.min(...connector.tracePath.map((point) => point.y))).toBe(
    groundLabel.anchorPoint.y,
  )
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
