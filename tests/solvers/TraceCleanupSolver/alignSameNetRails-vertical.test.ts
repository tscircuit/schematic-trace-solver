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

test("keeps a local pin loop separate from an external same-net rail", () => {
  const localLoop = getVerticalRailTraces()[0]!
  const upperExternal = createTrace(
    "upper-external",
    [
      { x: -1, y: 0 },
      { x: -2.5, y: 0 },
      { x: -2.5, y: 1 },
      { x: -4, y: 1 },
    ],
    [getVerticalPin("U1.2"), { pinId: "C1.1", chipId: "C1", x: -4, y: 1 }],
  )
  const lowerExternal = createTrace(
    "lower-external",
    [
      { x: -5, y: -1 },
      { x: -3, y: -1 },
      { x: -3, y: 0 },
      { x: -1, y: 0 },
    ],
    [{ pinId: "C2.1", chipId: "C2", x: -5, y: -1 }, getVerticalPin("U1.2")],
  )

  const result = align([localLoop, upperExternal, lowerExternal])
  const alignedLocalLoop = result.traces.find(
    (trace) => trace.mspPairId === localLoop.mspPairId,
  )!
  const alignedUpperExternal = result.traces.find(
    (trace) => trace.mspPairId === upperExternal.mspPairId,
  )!
  const alignedLowerExternal = result.traces.find(
    (trace) => trace.mspPairId === lowerExternal.mspPairId,
  )!

  expect(result.alignedRailGroupCount).toBe(1)
  expect(alignedLocalLoop.tracePath[1]!.x).toBe(-2)
  expect(alignedUpperExternal.tracePath[1]!.x).toBe(
    alignedLowerExternal.tracePath[2]!.x,
  )
  expect(alignedUpperExternal.tracePath[1]!.x).not.toBe(
    alignedLocalLoop.tracePath[1]!.x,
  )
})
