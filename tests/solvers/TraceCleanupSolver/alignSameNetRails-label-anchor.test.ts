import { expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { align, getVerticalRailTraces } from "./fixtures/alignSameNetRails"

test("preserves existing label anchors", () => {
  const traces = getVerticalRailTraces()
  const labels: NetLabelPlacement[] = [
    {
      globalConnNetId: "power-net",
      netId: "POWER",
      mspConnectionPairIds: ["upper"],
      pinIds: ["U1.1", "U1.2"],
      orientation: "x+",
      anchorPoint: { x: -2, y: 1 },
      center: { x: -1.8, y: 1 },
      width: 0.4,
      height: 0.2,
    },
    {
      globalConnNetId: "power-net",
      netId: "POWER",
      mspConnectionPairIds: ["lower"],
      pinIds: ["U1.2", "U1.3"],
      orientation: "x+",
      anchorPoint: { x: -3, y: -1 },
      center: { x: -2.8, y: -1 },
      width: 0.4,
      height: 0.2,
    },
  ]

  const result = align(traces, { netLabelPlacements: labels })

  expect(result.alignedRailGroupCount).toBe(0)
  expect(result.traces).toEqual(traces)
})
