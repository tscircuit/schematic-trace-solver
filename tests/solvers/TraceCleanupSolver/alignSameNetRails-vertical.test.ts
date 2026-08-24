import { expect, test } from "bun:test"
import {
  align,
  createTrace,
  getVerticalPin,
  getVerticalRailTraces,
} from "./fixtures/alignSameNetRails"

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

test("aligns multiple rails from one trace", () => {
  const trace = createTrace(
    "single",
    [
      { x: -1, y: 2 },
      { x: -2, y: 2 },
      { x: -2, y: 1 },
      { x: -3, y: 1 },
      { x: -3, y: 0 },
      { x: -1, y: 0 },
    ],
    [getVerticalPin("U1.1"), getVerticalPin("U1.2")],
  )

  const result = align([trace])

  expect(result).toMatchObject({
    alignedRailGroupCount: 1,
    alignedTraceCount: 1,
  })
  expect(result.traces[0]!.tracePath).toEqual([
    { x: -1, y: 2 },
    { x: -2, y: 2 },
    { x: -2, y: 0 },
    { x: -1, y: 0 },
  ])
})
