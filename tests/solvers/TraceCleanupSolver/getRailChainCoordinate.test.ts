import { expect, test } from "bun:test"
import { getRailChainCoordinate } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/getRailChainCoordinate"
import type { RailSegment } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/types"
import { createTrace } from "./fixtures/alignSameNetRails"

test("anchors a horizontal rail chain from the left regardless of trace order", () => {
  const leftPin = {
    chipId: "left-component",
    pinId: "left-pin",
    x: -2,
    y: 1,
    _facingDirection: "y+" as const,
  }
  const middlePin = {
    chipId: "middle-component",
    pinId: "middle-pin",
    x: 0,
    y: 1,
    _facingDirection: "y+" as const,
  }
  const rightPin = {
    chipId: "right-component",
    pinId: "right-pin",
    x: 2,
    y: 1,
    _facingDirection: "y+" as const,
  }
  const leftTrace = createTrace(
    "left-trace",
    [leftPin, { x: -2, y: 2 }, { x: 0, y: 2 }, middlePin],
    [leftPin, middlePin],
  )
  const rightTrace = createTrace(
    "right-trace",
    [middlePin, { x: 0, y: 3 }, { x: 2, y: 3 }, rightPin],
    [middlePin, rightPin],
  )
  const group: RailSegment[] = [
    {
      traceId: leftTrace.mspPairId,
      segmentIndex: 1,
      globalConnNetId: leftTrace.globalConnNetId,
      orientation: "horizontal",
      coordinate: 2,
      minAlong: -2,
      maxAlong: 0,
      componentId: leftPin.chipId,
      componentFacingDirection: "y+",
    },
    {
      traceId: rightTrace.mspPairId,
      segmentIndex: 1,
      globalConnNetId: rightTrace.globalConnNetId,
      orientation: "horizontal",
      coordinate: 3,
      minAlong: 0,
      maxAlong: 2,
      componentId: rightPin.chipId,
      componentFacingDirection: "y+",
    },
  ]

  expect(getRailChainCoordinate(group, [rightTrace, leftTrace])).toBe(2)
})
