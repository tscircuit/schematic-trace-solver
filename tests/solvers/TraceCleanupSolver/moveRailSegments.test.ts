import { expect, test } from "bun:test"
import { moveRailSegments } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/moveRailSegments"
import type { RailSegment } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/types"
import { createTrace, getVerticalPin } from "./fixtures/alignSameNetRails"

test("does not rewrite a rail for an epsilon-sized coordinate difference", () => {
  const railX = 1.3499999999999999
  const trace = createTrace(
    "epsilon-rail",
    [
      { x: 1.65, y: -3.2 },
      { x: railX, y: -3.2 },
      { x: railX, y: -1.4 },
      { x: 1.25, y: -1.4 },
    ],
    [getVerticalPin("U1.1"), getVerticalPin("U1.2")],
  )
  const segment: RailSegment = {
    traceId: trace.mspPairId,
    segmentIndex: 1,
    globalConnNetId: trace.globalConnNetId,
    orientation: "vertical",
    coordinate: railX,
    minAlong: -3.2,
    maxAlong: -1.4,
    componentId: "U1",
    componentFacingDirection: "x-",
  }

  const result = moveRailSegments(trace, [segment], 1.35)

  expect(result.tracePath).toEqual(trace.tracePath)
})
