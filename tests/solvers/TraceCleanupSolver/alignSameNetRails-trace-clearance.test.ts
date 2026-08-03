import { expect, test } from "bun:test"
import {
  align,
  createTrace,
  getVerticalRailTraces,
} from "./fixtures/alignSameNetRails"

test("does not align same-net rails against a different-net trace stroke", () => {
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

  expect(result.alignedRailGroupCount).toBe(0)
  expect(result.traces).toEqual(traces)
})
