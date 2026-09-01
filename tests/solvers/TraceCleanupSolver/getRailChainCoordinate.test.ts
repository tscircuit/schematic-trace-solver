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

test("does not anchor a vertical cross-component chain", () => {
  const topPin = {
    chipId: "top-component",
    pinId: "top-pin",
    x: 1,
    y: 2,
    _facingDirection: "x-" as const,
  }
  const middlePin = {
    chipId: "middle-component",
    pinId: "middle-pin",
    x: 1,
    y: 0,
    _facingDirection: "x-" as const,
  }
  const bottomPin = {
    chipId: "bottom-component",
    pinId: "bottom-pin",
    x: 1,
    y: -2,
    _facingDirection: "x-" as const,
  }
  const topTrace = createTrace(
    "top-trace",
    [topPin, { x: 2, y: 2 }, { x: 2, y: 0 }, middlePin],
    [topPin, middlePin],
  )
  const bottomTrace = createTrace(
    "bottom-trace",
    [middlePin, { x: 3, y: 0 }, { x: 3, y: -2 }, bottomPin],
    [middlePin, bottomPin],
  )
  const group: RailSegment[] = [
    {
      traceId: topTrace.mspPairId,
      segmentIndex: 1,
      globalConnNetId: topTrace.globalConnNetId,
      orientation: "vertical",
      coordinate: 2,
      minAlong: 0,
      maxAlong: 2,
      componentId: topPin.chipId,
      componentFacingDirection: "x-",
    },
    {
      traceId: bottomTrace.mspPairId,
      segmentIndex: 1,
      globalConnNetId: bottomTrace.globalConnNetId,
      orientation: "vertical",
      coordinate: 3,
      minAlong: -2,
      maxAlong: 0,
      componentId: bottomPin.chipId,
      componentFacingDirection: "x-",
    },
  ]

  expect(getRailChainCoordinate(group, [topTrace, bottomTrace])).toBeNull()
})
