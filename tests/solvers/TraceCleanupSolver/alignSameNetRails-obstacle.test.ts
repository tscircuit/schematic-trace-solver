import { expect, test } from "bun:test"
import {
  align,
  getVerticalRailTraces,
  verticalProblem,
} from "./fixtures/alignSameNetRails"

test("does not align through an obstacle", () => {
  const traces = getVerticalRailTraces()
  const result = align(traces, {
    inputProblem: {
      ...verticalProblem,
      chips: [
        ...verticalProblem.chips,
        {
          chipId: "barrier",
          center: { x: -2.5, y: 0 },
          width: 0.4,
          height: 0.4,
          pins: [],
        },
      ],
    },
  })

  expect(result.alignedRailGroupCount).toBe(0)
  expect(result.traces).toEqual(traces)
})
