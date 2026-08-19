import { expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import {
  align,
  createTrace,
  getVerticalRailTraces,
} from "./fixtures/alignSameNetRails"

test("preserves every trace joined at a net-label anchor", () => {
  const rails = getVerticalRailTraces()
  const anchorKeeper = createTrace(
    "anchor-keeper",
    [
      { x: -3, y: -1 },
      { x: -4, y: -1 },
    ],
    [
      { pinId: "X1.1", chipId: "X1", x: -3, y: -1 },
      { pinId: "X2.1", chipId: "X2", x: -4, y: -1 },
    ],
  )
  const traces = [...rails, anchorKeeper]
  const label: NetLabelPlacement = {
    globalConnNetId: "power-net",
    netId: "POWER",
    mspConnectionPairIds: [anchorKeeper.mspPairId],
    pinIds: anchorKeeper.pinIds,
    orientation: "x-",
    anchorPoint: { x: -3, y: -1 },
    center: { x: -3.2, y: -1 },
    width: 0.4,
    height: 0.2,
  }

  const result = align(traces, {
    netLabelPlacements: [label],
    eligibleTraceIds: new Set(rails.map((trace) => trace.mspPairId)),
  })

  expect(result.alignedRailGroupCount).toBe(0)
  expect(result.traces).toEqual(traces)
})
