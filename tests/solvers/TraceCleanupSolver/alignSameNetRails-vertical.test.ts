import { expect, test } from "bun:test"
import { align, getVerticalRailTraces } from "./fixtures/alignSameNetRails"

test("aligns same-net rails on one component side", () => {
  const result = align(getVerticalRailTraces())

  expect(result).toMatchObject({
    alignedRailGroupCount: 1,
    alignedTraceCount: 1,
  })
  expect(result.traces.map((trace) => trace.tracePath)).toEqual([
    [
      { x: -1, y: 2 },
      { x: -2, y: 2 },
      { x: -2, y: 0 },
      { x: -1, y: 0 },
    ],
    [
      { x: -1, y: 0 },
      { x: -2, y: 0 },
      { x: -2, y: -2 },
      { x: -1, y: -2 },
    ],
  ])
})
