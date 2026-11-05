import { expect, test } from "bun:test"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { countTurns } from "lib/solvers/TraceCleanupSolver/countTurns"
import { detectTraceLabelOverlap } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-rvboy-advance-soc-sheet.input.json"

// Complete soc sheet from seveibar/rvboy-advance 0.8.0.
// Release bb3effb5-7b41-4bc0-8c89-65c8c332d25f, captured before solver normalization
// with core 0.0.2277 at 60519165a2315fc7258d5612fd64ac7459af951d.
// The fixture preserves the full input without filtering or changing its geometry.
test("rvboy advance complete SOC sheet", async () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as InputProblem,
    {
      hideRatsNet: true,
    },
  )
  solver.solve()
  expect(solver.solved).toBe(true)

  const { traces, netLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()
  const powerLabel = netLabelPlacements.find(
    (label) =>
      label.netId === "V3V3" &&
      label.anchorPoint.x < 0 &&
      label.anchorPoint.y > 0,
  )!
  const rail = traces.find(
    (trace) => trace.mspPairId === powerLabel.mspConnectionPairIds[0],
  )!
  const railX = Math.min(...rail.tracePath.map((point) => point.x))
  const railTop = Math.max(...rail.tracePath.map((point) => point.y))
  expect(powerLabel.anchorPoint).toEqual({ x: railX, y: railTop })

  const usbLabel = netLabelPlacements.find(
    (label) => label.netId === "USB_1V8",
  )!
  const usbBounds = getRectBounds(
    usbLabel.center,
    usbLabel.width,
    usbLabel.height,
  )
  // The rail needs clearance for USB_1V8, without repeated detours expanding it.
  expect(usbBounds.minX - railX).toBeCloseTo(0.1)

  const codecTrace = traces.find((trace) => trace.userNetId === "CODEC_VCM")!
  expect(countTurns(codecTrace.tracePath)).toBe(1)
  expect(
    detectTraceLabelOverlap({
      traces: [codecTrace],
      netLabels: netLabelPlacements,
    }),
  ).toHaveLength(0)

  // Core uses source net names as netId. Supply display text only after routing
  // so snapshot labels are readable without affecting any solver decisions.
  for (const connection of solver.inputProblem.netConnections) {
    connection.netLabelText = connection.netId
  }

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
