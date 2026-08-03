import { expect, test } from "bun:test"
import {
  SCHEMATIC_TRACE_MIN_VISUAL_CENTERLINE_CLEARANCE,
  SCHEMATIC_TRACE_STROKE_WIDTH,
} from "lib/utils/doesPathCoincideWithTraces"
import {
  align,
  createTrace,
  getVerticalRailTraces,
} from "./fixtures/alignSameNetRails"

test("aligns same-net rails at a safe coordinate beside different-net traces", () => {
  const rails = getVerticalRailTraces()
  const foreignLowerTrace = createTrace(
    "foreign-lower",
    [
      { x: -2.02, y: -2 },
      { x: -2.02, y: -0.2 },
    ],
    [
      { pinId: "X1.1", chipId: "X1", x: -2.02, y: -2 },
      { pinId: "X2.1", chipId: "X2", x: -2.02, y: -0.2 },
    ],
    "foreign-lower-net",
  )
  const foreignUpperTrace = createTrace(
    "foreign-upper",
    [
      { x: -3.02, y: 0.2 },
      { x: -3.02, y: 2 },
    ],
    [
      { pinId: "X3.1", chipId: "X3", x: -3.02, y: 0.2 },
      { pinId: "X4.1", chipId: "X4", x: -3.02, y: 2 },
    ],
    "foreign-upper-net",
  )
  const traces = [...rails, foreignLowerTrace, foreignUpperTrace]

  const result = align(traces, {
    eligibleTraceIds: new Set(rails.map((trace) => trace.mspPairId)),
  })

  expect(result.alignedRailGroupCount).toBe(1)

  const alignedUpper = result.traces.find(
    (trace) => trace.mspPairId === "upper",
  )!
  const alignedLower = result.traces.find(
    (trace) => trace.mspPairId === "lower",
  )!
  const upperRailX = alignedUpper.tracePath[1]!.x
  const lowerRailX = alignedLower.tracePath[1]!.x

  expect(upperRailX).toBe(lowerRailX)
  expect(
    Math.abs(upperRailX - foreignLowerTrace.tracePath[0]!.x),
  ).toBeGreaterThan(SCHEMATIC_TRACE_STROKE_WIDTH)
  expect(
    Math.abs(upperRailX - foreignUpperTrace.tracePath[0]!.x),
  ).toBeGreaterThan(SCHEMATIC_TRACE_STROKE_WIDTH)
  expect(
    Math.min(
      Math.abs(upperRailX - foreignLowerTrace.tracePath[0]!.x),
      Math.abs(upperRailX - foreignUpperTrace.tracePath[0]!.x),
    ),
  ).toBeCloseTo(SCHEMATIC_TRACE_MIN_VISUAL_CENTERLINE_CLEARANCE, 6)
})
