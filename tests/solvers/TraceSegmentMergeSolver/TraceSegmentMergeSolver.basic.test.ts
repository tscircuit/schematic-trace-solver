import { expect, test } from "bun:test"
import {
  hasHorizontalSegmentAtY,
  hasVerticalSegmentAtX,
  makeTrace,
  solve,
  solveTracePathsByPairId,
  type SolvedTracePath,
} from "./TraceSegmentMergeSolver.helpers"

test("merges nearby same-net horizontal terminal segments while preserving endpoints", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 1, y: 0.08 },
      { x: 3, y: 0.08 },
    ]),
  ]

  const [first, second] = solve(traces)

  expect(first!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: 0.04 },
    { x: 4, y: 0.04 },
    { x: 4, y: 0 },
  ])
  expect(second!.tracePath).toEqual([
    { x: 1, y: 0.08 },
    { x: 1, y: 0.04 },
    { x: 3, y: 0.04 },
    { x: 3, y: 0.08 },
  ])
})

test("merges nearby same-net vertical terminal segments while preserving endpoints", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 0, y: 4 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 0.1, y: 1 },
      { x: 0.1, y: 3 },
    ]),
  ]

  const [first, second] = solve(traces)

  expect(first!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 0.05, y: 0 },
    { x: 0.05, y: 4 },
    { x: 0, y: 4 },
  ])
  expect(second!.tracePath).toEqual([
    { x: 0.1, y: 1 },
    { x: 0.05, y: 1 },
    { x: 0.05, y: 3 },
    { x: 0.1, y: 3 },
  ])
})

test("merges reversed horizontal and vertical segments without flipping endpoints", () => {
  const horizontalTraces = [
    makeTrace("A-B", "net-1", [
      { x: 4, y: 0 },
      { x: 0, y: 0 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 3, y: 0.08 },
      { x: 1, y: 0.08 },
    ]),
  ]
  const verticalTraces = [
    makeTrace("E-F", "net-2", [
      { x: 0, y: 4 },
      { x: 0, y: 0 },
    ]),
    makeTrace("G-H", "net-2", [
      { x: 0.1, y: 3 },
      { x: 0.1, y: 1 },
    ]),
  ]

  const [firstHorizontal, secondHorizontal] = solve(horizontalTraces)
  const [firstVertical, secondVertical] = solve(verticalTraces)

  expect(firstHorizontal!.tracePath).toEqual([
    { x: 4, y: 0 },
    { x: 4, y: 0.04 },
    { x: 0, y: 0.04 },
    { x: 0, y: 0 },
  ])
  expect(secondHorizontal!.tracePath).toEqual([
    { x: 3, y: 0.08 },
    { x: 3, y: 0.04 },
    { x: 1, y: 0.04 },
    { x: 1, y: 0.08 },
  ])
  expect(firstVertical!.tracePath).toEqual([
    { x: 0, y: 4 },
    { x: 0.05, y: 4 },
    { x: 0.05, y: 0 },
    { x: 0, y: 0 },
  ])
  expect(secondVertical!.tracePath).toEqual([
    { x: 0.1, y: 3 },
    { x: 0.05, y: 3 },
    { x: 0.05, y: 1 },
    { x: 0.1, y: 1 },
  ])
})

test("uses one deterministic coordinate for transitive same-net clusters", () => {
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
      { x: 0, y: 0.16 },
      { x: 4, y: 0.16 },
    ]),
  ]

  const output = solve(traces)

  for (const trace of output) {
    expect(hasHorizontalSegmentAtY(trace, 0.08, 0, 4)).toBe(true)
  }
})

test("produces the same geometry when input traces are permuted", () => {
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
      { x: 0, y: 0.16 },
      { x: 4, y: 0.16 },
    ]),
  ]

  expect(solveTracePathsByPairId([traces[2]!, traces[0]!, traces[1]!])).toEqual(
    solveTracePathsByPairId(traces),
  )
})

test("uses a stable coordinate for tied-distance clusters", () => {
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
      { x: 0, y: 0.16 },
      { x: 4, y: 0.16 },
    ]),
    makeTrace("G-H", "net-1", [
      { x: 0, y: 0.24 },
      { x: 4, y: 0.24 },
    ]),
  ]

  const output = solve(traces)

  for (const trace of output) {
    expect(hasHorizontalSegmentAtY(trace, 0.12, 0, 4)).toBe(true)
  }
})

test("merges two independent clusters that touch different segments of the same trace", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 8, y: 4 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 1, y: 0.08 },
      { x: 3, y: 0.08 },
    ]),
    makeTrace("E-F", "net-1", [
      { x: 5, y: 4.08 },
      { x: 7, y: 4.08 },
    ]),
  ]

  const [mainTrace, firstMergeTrace, secondMergeTrace] = solve(traces)

  expect(mainTrace!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: 0.04 },
    { x: 4, y: 0.04 },
    { x: 4, y: 4.04 },
    { x: 8, y: 4.04 },
    { x: 8, y: 4 },
  ])
  expect(firstMergeTrace!.tracePath).toEqual([
    { x: 1, y: 0.08 },
    { x: 1, y: 0.04 },
    { x: 3, y: 0.04 },
    { x: 3, y: 0.08 },
  ])
  expect(secondMergeTrace!.tracePath).toEqual([
    { x: 5, y: 4.08 },
    { x: 5, y: 4.04 },
    { x: 7, y: 4.04 },
    { x: 7, y: 4.08 },
  ])
})

test("handles adjacent segments that participate in separate horizontal and vertical clusters", () => {
  const traces = [
    makeTrace("A-B", "net-1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
    ]),
    makeTrace("C-D", "net-1", [
      { x: 1, y: 0.08 },
      { x: 3, y: 0.08 },
    ]),
    makeTrace("E-F", "net-1", [
      { x: 4.08, y: 1 },
      { x: 4.08, y: 3 },
    ]),
  ]

  const [mainTrace, horizontalTrace, verticalTrace] = solve(traces)

  expect(mainTrace!.tracePath[0]).toEqual({ x: 0, y: 0 })
  expect(mainTrace!.tracePath[mainTrace!.tracePath.length - 1]).toEqual({
    x: 4,
    y: 4,
  })
  expect(hasHorizontalSegmentAtY(mainTrace!, 0.04, 0, 4)).toBe(true)
  expect(hasVerticalSegmentAtX(mainTrace!, 4.04, 0.04, 4)).toBe(true)
  expect(hasHorizontalSegmentAtY(horizontalTrace!, 0.04, 1, 3)).toBe(true)
  expect(hasVerticalSegmentAtX(verticalTrace!, 4.04, 1, 3)).toBe(true)
})
