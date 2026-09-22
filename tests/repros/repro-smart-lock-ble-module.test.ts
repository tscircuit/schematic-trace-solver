import { expect, test } from "bun:test"
import { getAnchoredNetLabelRenderedBounds } from "lib/solvers/InlineNetLabelSolver/getAnchoredNetLabelRenderedBounds"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { detectTraceLabelOverlap } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import input from "./assets/repro-smart-lock-ble-module.input.json"

// Full ble_module sheet from imrishabh18/smart-lock v0.0.1.
// Reconstructed from deployed Circuit JSON with current core routing defaults.
test("repro smart-lock BLE module schematic sheet", async () => {
  const solver = new SchematicTracePipelineSolver(
    structuredClone(input) as unknown as InputProblem,
    { hideRatsNet: true },
  )
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const { traces, netLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()
  const supplyLabel = netLabelPlacements.find((label) =>
    label.mspConnectionPairIds.includes(
      "schematic_port_246-schematic_port_243",
    ),
  )!
  // VDDS at U1 must remain free to slide along its original host trace,
  // even where another same-net trace meets it. Treating that junction as
  // an extended connector pins the label across the neighboring traces.
  const u1SupplyLabel = netLabelPlacements.find(
    (label) =>
      label.netId === "VDDS" && Math.abs(label.anchorPoint.x + 3.421) < 1e-6,
  )!
  expect(u1SupplyLabel).toBeDefined()
  expect(u1SupplyLabel.orientation).toBe("x-")
  expect(u1SupplyLabel.anchorPoint.y).toBeCloseTo(0.95)
  const supplyBounds = getAnchoredNetLabelRenderedBounds(u1SupplyLabel)
  const crossingTraces = traces.filter(
    (trace) =>
      trace.globalConnNetId !== u1SupplyLabel.globalConnNetId &&
      trace.tracePath
        .slice(1)
        .some((end, index) =>
          segmentIntersectsRect(trace.tracePath[index]!, end, supplyBounds),
        ),
  )
  expect(crossingTraces).toHaveLength(0)

  // C99, C104, C103, and C102 must share C101's labeled VDDS rail.
  for (const traceId of [
    "schematic_port_244-schematic_port_246",
    "schematic_port_248-schematic_port_246",
    "schematic_port_250-schematic_port_248",
    "schematic_port_252-schematic_port_250",
  ]) {
    const trace = traces.find((trace) => trace.mspPairId === traceId)!
    expect(trace.tracePath[1]!.y).toBeCloseTo(supplyLabel.anchorPoint.y)
    expect(trace.tracePath[2]!.y).toBeCloseTo(supplyLabel.anchorPoint.y)
  }

  // The C92–L34 ground trace needs one offset around U1's label column.
  const groundTrace = traces.find(
    (trace) => trace.mspPairId === "schematic_port_291-schematic_port_297",
  )!
  const path = groundTrace.tracePath
  expect(path).toHaveLength(6)
  expect(path[2]!.x).toBeCloseTo(path[3]!.x)
  expect(path[3]!.y).toBeCloseTo(path[4]!.y)
  for (const [endpoint, neighbor, pin] of [
    [path[0]!, path[1]!, groundTrace.pins[0]!],
    [path.at(-1)!, path.at(-2)!, groundTrace.pins[1]!],
  ] as const) {
    expect(endpoint.x).toBeCloseTo(pin.x)
    expect(endpoint.y).toBeCloseTo(pin.y)
    expect(neighbor.x).toBeCloseTo(endpoint.x)
    expect(neighbor.y).toBeLessThan(endpoint.y)
  }
  expect(
    isPathCollidingWithObstacles(path, getObstacleRects(solver.inputProblem)),
  ).toBe(false)
  expect(
    detectTraceLabelOverlap({
      traces: [groundTrace],
      netLabels: netLabelPlacements,
    }),
  ).toHaveLength(0)

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
