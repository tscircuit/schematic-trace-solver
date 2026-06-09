import { expect, test } from "bun:test"
import type { Point } from "@tscircuit/math-utils"
import { findSameNetSegmentMerge } from "lib/solvers/SameNetTraceMergeSolver/findSameNetSegmentMerge"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const fakeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Point[],
): SolvedTracePath => {
  const start = tracePath[0]!
  const end = tracePath[tracePath.length - 1]!
  return {
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [
      { pinId: `${mspPairId}-start`, chipId: "FAKE1", x: start.x, y: start.y },
      { pinId: `${mspPairId}-end`, chipId: "FAKE2", x: end.x, y: end.y },
    ],
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [`${mspPairId}-start`, `${mspPairId}-end`],
  }
}

const defaultParams = {
  obstacles: [],
  anchorPoints: [],
  maxMergeOffset: 0.09,
}

test("merges nearly-collinear same-net segments onto the longer segment", () => {
  const traces = [
    // Interior vertical at x=0.05, spanning y=0..2
    fakeTrace("A", "net1", [
      { x: 2, y: 0 },
      { x: 0.05, y: 0 },
      { x: 0.05, y: 2 },
      { x: 2, y: 2 },
    ]),
    // Interior vertical at x=0, spanning y=2..5 (longer, touching at y=2)
    fakeTrace("B", "net1", [
      { x: 2, y: 2 },
      { x: 0, y: 2 },
      { x: 0, y: 5 },
      { x: 2, y: 5 },
    ]),
  ]

  const merge = findSameNetSegmentMerge({ ...defaultParams, traces })

  expect(merge).not.toBeNull()
  expect(merge!.traceIndex).toBe(0)
  expect(merge!.orientation).toBe("vertical")
  expect(merge!.fromCoord).toBeCloseTo(0.05, 9)
  expect(merge!.toCoord).toBeCloseTo(0, 9)
  expect(merge!.newTracePath).toEqual([
    { x: 2, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 2 },
    { x: 2, y: 2 },
  ])
})

test("never moves segments containing a path endpoint (pin)", () => {
  const traces = [
    // The vertical at x=0.05 contains the path start -> not movable
    fakeTrace("A", "net1", [
      { x: 0.05, y: 0 },
      { x: 0.05, y: 2 },
      { x: 2, y: 2 },
    ]),
    // The vertical at x=0 contains the path end -> not movable
    fakeTrace("B", "net1", [
      { x: 2, y: 2 },
      { x: 0, y: 2 },
      { x: 0, y: 5 },
    ]),
  ]

  expect(findSameNetSegmentMerge({ ...defaultParams, traces })).toBeNull()
})

test("does not merge segments further apart than maxMergeOffset", () => {
  const traces = [
    fakeTrace("A", "net1", [
      { x: 2, y: 0 },
      { x: 0.3, y: 0 },
      { x: 0.3, y: 2 },
      { x: 2, y: 2 },
    ]),
    fakeTrace("B", "net1", [
      { x: 2, y: 2 },
      { x: 0, y: 2 },
      { x: 0, y: 5 },
      { x: 2, y: 5 },
    ]),
  ]

  expect(findSameNetSegmentMerge({ ...defaultParams, traces })).toBeNull()
})

test("does not merge segments of different nets", () => {
  const traces = [
    fakeTrace("A", "net1", [
      { x: 2, y: 0 },
      { x: 0.05, y: 0 },
      { x: 0.05, y: 2 },
      { x: 2, y: 2 },
    ]),
    fakeTrace("B", "net2", [
      { x: 2, y: 2 },
      { x: 0, y: 2 },
      { x: 0, y: 5 },
      { x: 2, y: 5 },
    ]),
  ]

  expect(findSameNetSegmentMerge({ ...defaultParams, traces })).toBeNull()
})

test("does not merge when the moved segment would enter a chip body", () => {
  const traces = [
    fakeTrace("A", "net1", [
      { x: 2, y: 0 },
      { x: 0.05, y: 0 },
      { x: 0.05, y: 2 },
      { x: 2, y: 2 },
    ]),
    fakeTrace("B", "net1", [
      { x: 2, y: 2 },
      { x: 0, y: 2 },
      { x: 0, y: 5 },
      { x: 2, y: 5 },
    ]),
  ]
  // Chip body sitting on x=0 between y=0..2 (where the moved line would land)
  const obstacles = [{ minX: -0.5, maxX: 0.02, minY: 0.5, maxY: 1.5 }]

  expect(
    findSameNetSegmentMerge({ ...defaultParams, traces, obstacles }),
  ).toBeNull()
})

test("does not merge onto a different net's trace line", () => {
  const traces = [
    fakeTrace("A", "net1", [
      { x: 2, y: 0 },
      { x: 0.05, y: 0 },
      { x: 0.05, y: 2 },
      { x: 2, y: 2 },
    ]),
    fakeTrace("B", "net1", [
      { x: 2, y: 2 },
      { x: 0, y: 2 },
      { x: 0, y: 5 },
      { x: 2, y: 5 },
    ]),
    // A different net already runs at x=0 over y=0..2; the spacing between
    // x=0.05 and x=0 is deliberate and must be preserved
    fakeTrace("C", "net2", [
      { x: -1, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 1.5 },
      { x: -1, y: 1.5 },
    ]),
  ]

  expect(findSameNetSegmentMerge({ ...defaultParams, traces })).toBeNull()
})

test("does not move a segment off of an anchor point resting on it", () => {
  const traces = [
    fakeTrace("A", "net1", [
      { x: 2, y: 0 },
      { x: 0.05, y: 0 },
      { x: 0.05, y: 2 },
      { x: 2, y: 2 },
    ]),
    fakeTrace("B", "net1", [
      { x: 2, y: 2 },
      { x: 0, y: 2 },
      { x: 0, y: 5 },
      { x: 2, y: 5 },
    ]),
  ]
  // A pin sits in the middle of A's vertical segment
  const anchorPoints = [{ x: 0.05, y: 1 }]

  expect(
    findSameNetSegmentMerge({ ...defaultParams, traces, anchorPoints }),
  ).toBeNull()
})
