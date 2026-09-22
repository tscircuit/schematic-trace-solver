import { expect, test } from "bun:test"
import { getAnchoredNetLabelRenderedBounds } from "lib/solvers/InlineNetLabelSolver/getAnchoredNetLabelRenderedBounds"
import { segmentCrossesBoundsInterior } from "lib/solvers/AvailableNetOrientationSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-allwinner-t113-power-label-crossing.input.json"

// Captured from @tscircuit/core's
// tests/repros/repro184-allwinner-t113-analog-net-label-crossing.test.tsx.
// Keep the upper supply pins to preserve the AVCC–HPVCC rail geometry.
test("keeps Allwinner T113 traces clear of their power-label bodies", async () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)

  solver.solve()

  expect(solver.solved).toBe(true)
  const { traces, netLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()
  const label = netLabelPlacements.find(
    (placement) =>
      placement.netId === "LDOA1V8" &&
      placement.pinIds.includes("schematic_port_26"),
  )!
  expect(label).toBeDefined()
  const bounds = getAnchoredNetLabelRenderedBounds(label)
  const crossings = traces.flatMap((trace) =>
    trace.tracePath
      .slice(1)
      .filter((end, index) =>
        segmentCrossesBoundsInterior(trace.tracePath[index]!, end, bounds),
      ),
  )
  expect(crossings).toHaveLength(0)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})

test("keeps the original core power-label bounds clear after rail alignment", () => {
  // Core supplies label dimensions and renders the power symbols itself.
  // The readable snapshot fixture adds netLabelText for named-tag rendering.
  const originalInput = structuredClone(inputProblem) as InputProblem
  for (const connection of originalInput.netConnections) {
    delete connection.netLabelText
  }
  const solver = new SchematicTracePipelineSolver(originalInput)
  solver.solve()

  expect(solver.solved).toBe(true)
  const { traces, netLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()
  const label = netLabelPlacements.find(
    (placement) =>
      placement.netId === "LDOA1V8" &&
      placement.pinIds.includes("schematic_port_26"),
  )!
  expect(label).toBeDefined()
  const bounds = getAnchoredNetLabelRenderedBounds(label)
  for (const trace of traces) {
    for (let i = 1; i < trace.tracePath.length; i++) {
      expect(
        segmentCrossesBoundsInterior(
          trace.tracePath[i - 1]!,
          trace.tracePath[i]!,
          bounds,
        ),
      ).toBe(false)
    }
  }
  expect(
    traces.some(
      (trace) =>
        label.mspConnectionPairIds.includes(trace.mspPairId) &&
        trace.globalConnNetId === label.globalConnNetId &&
        tracePathContainsPoint(trace.tracePath, label.anchorPoint),
    ),
  ).toBe(true)
})
