import { expect, test } from "bun:test"
import {
  hasHorizontalSegmentAtY,
  hasVerticalSegmentAtX,
  makeTrace,
  solve,
  solveTracePathsByPairId,
  type SolvedTracePath,
} from "./TraceSegmentMergeSolver.helpers"

test("does not merge different nets even when segments overlap and are close", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    makeTrace("C-D", "net-2", [
      { x: 1, y: 0.08 },
      { x: 3, y: 0.08 },
    ]),
  ]

  expect(solve(traces).map((trace) => trace.tracePath)).toEqual(
    traces.map((trace) => trace.tracePath),
  )
})

test("does not merge when the destination would overlap another net", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 0, y: 0.08 },
      { x: 4, y: 0.08 },
    ]),
    makeTrace("E-F", "net-2", [
      { x: 1, y: 0.04 },
      { x: 3, y: 0.04 },
    ]),
  ]

  expect(solve(traces).map((trace) => trace.tracePath)).toEqual(
    traces.map((trace) => trace.tracePath),
  )
})

test("does not merge when a generated terminal jog would overlap another net", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 0, y: 0.08 },
      { x: 4, y: 0.08 },
    ]),
    makeTrace("E-F", "net-2", [
      { x: 0, y: 0.005 },
      { x: 0, y: 0.035 },
    ]),
  ]

  expect(solve(traces).map((trace) => trace.tracePath)).toEqual(
    traces.map((trace) => trace.tracePath),
  )
})

test("does not merge when a generated vertical terminal jog would overlap another net", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 0, y: 4 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 0.08, y: 0 },
      { x: 0.08, y: 4 },
    ]),
    makeTrace("E-F", "net-2", [
      { x: 0.005, y: 0 },
      { x: 0.035, y: 0 },
    ]),
  ]

  expect(solve(traces).map((trace) => trace.tracePath)).toEqual(
    traces.map((trace) => trace.tracePath),
  )
})

test("does not apply two individually valid clusters when their combined output collides", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 0, y: 0.08 },
      { x: 4, y: 0.08 },
    ]),
    makeTrace("E-F", "net-2", [
      { x: 0, y: -0.01 },
      { x: 4, y: -0.01 },
    ]),
    makeTrace("G-H", "net-2", [
      { x: 0, y: 0.09 },
      { x: 4, y: 0.09 },
    ]),
  ]

  const [firstNetA, firstNetB, secondNetA, secondNetB] = solve(traces)

  expect(hasHorizontalSegmentAtY(firstNetA!, 0.04, 0, 4)).toBe(true)
  expect(hasHorizontalSegmentAtY(firstNetB!, 0.04, 0, 4)).toBe(true)
  expect(secondNetA!.tracePath).toEqual(traces[2]!.tracePath)
  expect(secondNetB!.tracePath).toEqual(traces[3]!.tracePath)
})

test("allows another same-net segment at the merge destination", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 0, y: 0.08 },
      { x: 4, y: 0.08 },
    ]),
    makeTrace("E-F", "net-1", [
      { x: 1, y: 0.04 },
      { x: 3, y: 0.04 },
    ]),
  ]

  const [first, second, alreadyAtDestination] = solve(traces)

  expect(hasHorizontalSegmentAtY(first!, 0.04, 0, 4)).toBe(true)
  expect(hasHorizontalSegmentAtY(second!, 0.04, 0, 4)).toBe(true)
  expect(alreadyAtDestination!.tracePath).toEqual(traces[2]!.tracePath)
})

test("allows a merge when another net only touches a generated jog endpoint", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 0, y: 0.08 },
      { x: 4, y: 0.08 },
    ]),
    makeTrace("E-F", "net-2", [
      { x: 0, y: 0.08 },
      { x: 0, y: 0.12 },
    ]),
  ]

  const [first, second, touchingTrace] = solve(traces)

  expect(first!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: 0.04 },
    { x: 4, y: 0.04 },
    { x: 4, y: 0 },
  ])
  expect(second!.tracePath).toEqual([
    { x: 0, y: 0.08 },
    { x: 0, y: 0.04 },
    { x: 4, y: 0.04 },
    { x: 4, y: 0.08 },
  ])
  expect(touchingTrace!.tracePath).toEqual(traces[2]!.tracePath)
})

test("keeps a valid farther candidate when a closer candidate is blocked by collision", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 0, y: 0.04 },
      { x: 1, y: 0.04 },
    ]),
    makeTrace("E-F", "net-1", [
      { x: 3, y: 0.12 },
      { x: 4, y: 0.12 },
    ]),
    makeTrace("G-H", "net-2", [
      { x: 0, y: 0.02 },
      { x: 1, y: 0.02 },
    ]),
  ]

  const [wideTrace, blockedTrace, validTrace, obstacleTrace] = solve(traces)

  expect(hasHorizontalSegmentAtY(wideTrace!, 0.06, 0, 4)).toBe(true)
  expect(blockedTrace!.tracePath).toEqual(traces[1]!.tracePath)
  expect(hasHorizontalSegmentAtY(validTrace!, 0.06, 3, 4)).toBe(true)
  expect(obstacleTrace!.tracePath).toEqual(traces[3]!.tracePath)
})
