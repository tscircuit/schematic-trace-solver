import { expect, test } from "bun:test"
import {
  align,
  createTrace,
  getVerticalPin,
  getVerticalRailTraces,
} from "./fixtures/alignSameNetRails"

test("uses routed-trace provenance to exclude generated label connectors", () => {
  const realTrace = getVerticalRailTraces()[0]!
  const connector = createTrace(
    "label-connector",
    [
      { x: -1, y: 0 },
      { x: -5, y: 0 },
      { x: -5, y: -2 },
      { x: -1, y: -2 },
    ],
    [getVerticalPin("U1.2"), getVerticalPin("U1.3")],
  )

  const result = align([realTrace, connector], {
    eligibleTraceIds: new Set([realTrace.mspPairId]),
  })

  expect(result.alignedRailGroupCount).toBe(0)
  expect(result.traces).toEqual([realTrace, connector])
})
