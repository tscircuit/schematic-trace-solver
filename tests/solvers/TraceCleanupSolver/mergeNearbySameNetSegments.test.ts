import { expect, test } from "bun:test"
import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { mergeNearbySameNetSegments } from "lib/solvers/TraceCleanupSolver/mergeNearbySameNetSegments"

const makeTrace = (
  id: string,
  netId: string,
  tracePath: Point[],
): SolvedTracePath =>
  ({
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    userNetId: netId,
    pins: [] as any,
    pinIds: [],
    mspConnectionPairIds: [id],
    tracePath,
  }) as SolvedTracePath

const closeHorizontalTraces = () => [
  makeTrace("trunk", "N1", [
    { x: 1, y: 0 },
    { x: 4, y: 0 },
  ]),
  makeTrace("branch", "N1", [
    { x: 0, y: 1 },
    { x: 1, y: 0.06 },
    { x: 4, y: 0.06 },
    { x: 5, y: 1 },
  ]),
]

test("aligns close horizontal same-net internal segments to an existing trunk", () => {
  const result = mergeNearbySameNetSegments(closeHorizontalTraces())

  expect(result.traces[1]!.tracePath[1]!.y).toBe(0)
  expect(result.traces[1]!.tracePath[2]!.y).toBe(0)
  expect(result.mergedSegmentCount).toBe(1)
})

test("aligns close vertical same-net internal segments", () => {
  const result = mergeNearbySameNetSegments([
    makeTrace("trunk", "N1", [
      { x: 0, y: 1 },
      { x: 0, y: 4 },
    ]),
    makeTrace("branch", "N1", [
      { x: 1, y: 0 },
      { x: 0.05, y: 1 },
      { x: 0.05, y: 4 },
      { x: 1, y: 5 },
    ]),
  ])

  expect(result.traces[1]!.tracePath[1]!.x).toBe(0)
  expect(result.traces[1]!.tracePath[2]!.x).toBe(0)
})

test("averages equally sized movable same-net segments", () => {
  const result = mergeNearbySameNetSegments([
    makeTrace("first", "N1", [
      { x: 0, y: 1 },
      { x: 1, y: 0 },
      { x: 4, y: 0 },
      { x: 5, y: 1 },
    ]),
    makeTrace("second", "N1", [
      { x: 0, y: 2 },
      { x: 1, y: 0.08 },
      { x: 4, y: 0.08 },
      { x: 5, y: 2 },
    ]),
  ])

  expect(result.traces[0]!.tracePath[1]!.y).toBe(0.04)
  expect(result.traces[1]!.tracePath[1]!.y).toBe(0.04)
})

test("does not align segments from the same trace", () => {
  const original = makeTrace("jog", "N1", [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 0.04 },
    { x: 4, y: 0.04 },
    { x: 4, y: 1 },
  ])
  const result = mergeNearbySameNetSegments([original])

  expect(result.traces[0]!.tracePath).toEqual(original.tracePath)
  expect(result.mergedSegmentCount).toBe(0)
})

test("does not align segments from different nets", () => {
  const result = mergeNearbySameNetSegments([
    closeHorizontalTraces()[0]!,
    makeTrace("other-net", "N2", [
      { x: 0, y: 1 },
      { x: 1, y: 0.06 },
      { x: 4, y: 0.06 },
      { x: 5, y: 1 },
    ]),
  ])

  expect(result.traces[1]!.tracePath[1]!.y).toBe(0.06)
  expect(result.mergedSegmentCount).toBe(0)
})

test("rejects alignment that would cross a different-net trace", () => {
  const result = mergeNearbySameNetSegments([
    ...closeHorizontalTraces(),
    makeTrace("blocker", "N2", [
      { x: 2, y: -1 },
      { x: 2, y: 0.03 },
    ]),
  ])

  expect(result.traces[1]!.tracePath[1]!.y).toBe(0.06)
  expect(result.mergedSegmentCount).toBe(0)
})

test("rejects alignment that would enter a static obstacle", () => {
  const result = mergeNearbySameNetSegments(closeHorizontalTraces(), {
    inputProblem: {
      chips: [
        {
          chipId: "U1",
          center: { x: 2.5, y: 0 },
          width: 0.5,
          height: 0.04,
          pins: [],
        },
      ],
      connections: [],
    } as any,
  })

  expect(result.traces[1]!.tracePath[1]!.y).toBe(0.06)
  expect(result.mergedSegmentCount).toBe(0)
})

test("rejects alignment that would enter a different-net label", () => {
  const result = mergeNearbySameNetSegments(closeHorizontalTraces(), {
    allLabelPlacements: [
      {
        globalConnNetId: "N2",
        center: { x: 2.5, y: 0 },
        width: 0.5,
        height: 0.04,
      } as any,
    ],
  })

  expect(result.traces[1]!.tracePath[1]!.y).toBe(0.06)
  expect(result.mergedSegmentCount).toBe(0)
})

test("is idempotent and respects the axis tolerance", () => {
  const first = mergeNearbySameNetSegments(closeHorizontalTraces())
  const second = mergeNearbySameNetSegments(first.traces)
  const outsideTolerance = mergeNearbySameNetSegments(
    [
      closeHorizontalTraces()[0]!,
      makeTrace("far-branch", "N1", [
        { x: 0, y: 1 },
        { x: 1, y: 0.11 },
        { x: 4, y: 0.11 },
        { x: 5, y: 1 },
      ]),
    ],
    { axisTolerance: 0.1 },
  )

  expect(second.traces).toEqual(first.traces)
  expect(second.mergedSegmentCount).toBe(0)
  expect(outsideTolerance.traces[1]!.tracePath[1]!.y).toBe(0.11)
})
