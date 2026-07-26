import { expect, test } from "bun:test"
import {
  align,
  createTrace,
  getVerticalPin,
  getVerticalRailTraces,
  verticalProblem,
} from "./fixtures/alignSameNetRails"

test("keeps the baseline when alignment would only lengthen visible geometry", () => {
  const traces = getVerticalRailTraces()
  traces[1] = createTrace(
    "lower",
    [
      { x: -1, y: 0 },
      { x: -10, y: 0 },
      { x: -10, y: -2 },
      { x: -1, y: -2 },
    ],
    [getVerticalPin("U1.2"), getVerticalPin("U1.3")],
  )
  const result = align(traces, {
    inputProblem: {
      ...verticalProblem,
      chips: [
        ...verticalProblem.chips,
        {
          chipId: "blocks-short-candidate",
          center: { x: -2, y: -1 },
          width: 0.2,
          height: 0.4,
          pins: [],
        },
      ],
    },
  })

  expect(result.alignedRailGroupCount).toBe(0)
  expect(result.traces).toEqual(traces)
})
