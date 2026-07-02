import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { combineCloseSameNetSegments } from "lib/solvers/TraceCleanupSolver/combineCloseSameNetSegments"

const baseTrace = (
  id: string,
  netId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    pins: [] as any,
    pinIds: [],
    mspConnectionPairIds: [id],
    tracePath,
  }) as SolvedTracePath

test("snaps close parallel same-net segments onto the longer segment", () => {
  const traces = [
    baseTrace("a", "N1", [
      { x: -1, y: -1 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 3 },
    ]),
    baseTrace("b", "N1", [
      { x: -1, y: 2 },
      { x: 1, y: 0.05 },
      { x: 9, y: 0.05 },
      { x: 9, y: 2 },
    ]),
  ]

  const combined = combineCloseSameNetSegments(traces, 0.1)

  expect(combined[1]!.tracePath[1]).toEqual({ x: 1, y: 0 })
  expect(combined[1]!.tracePath[2]).toEqual({ x: 9, y: 0 })
})

test("does not snap nearby segments from different nets", () => {
  const traces = [
    baseTrace("a", "N1", [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]),
    baseTrace("b", "N2", [
      { x: 1, y: 0.05 },
      { x: 9, y: 0.05 },
    ]),
  ]

  const combined = combineCloseSameNetSegments(traces, 0.1)

  expect(combined[1]!.tracePath).toEqual(traces[1]!.tracePath)
})

test("does not snap same-net segments outside the distance threshold", () => {
  const traces = [
    baseTrace("a", "N1", [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]),
    baseTrace("b", "N1", [
      { x: 1, y: 0.5 },
      { x: 9, y: 0.5 },
    ]),
  ]

  const combined = combineCloseSameNetSegments(traces, 0.1)

  expect(combined[1]!.tracePath).toEqual(traces[1]!.tracePath)
})

test("preserves terminal pin legs", () => {
  const traces = [
    baseTrace("a", "N1", [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]),
    baseTrace("b", "N1", [
      { x: 1, y: 0.05 },
      { x: 9, y: 0.05 },
    ]),
  ]

  const combined = combineCloseSameNetSegments(traces, 0.1)

  expect(combined[0]!.tracePath).toEqual(traces[0]!.tracePath)
  expect(combined[1]!.tracePath).toEqual(traces[1]!.tracePath)
})

test("rejects snaps that would overlap a different-net segment", () => {
  const traces = [
    baseTrace("a", "N1", [
      { x: -1, y: -1 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 11, y: 1 },
    ]),
    baseTrace("b", "N1", [
      { x: -1, y: 2 },
      { x: 1, y: 0.05 },
      { x: 9, y: 0.05 },
      { x: 11, y: 2 },
    ]),
    baseTrace("c", "N2", [
      { x: -1, y: 3 },
      { x: 2, y: 0 },
      { x: 8, y: 0 },
      { x: 11, y: 3 },
    ]),
  ]

  const combined = combineCloseSameNetSegments(traces, 0.1)

  expect(combined[1]!.tracePath[1]).toEqual({ x: 1, y: 0.05 })
  expect(combined[1]!.tracePath[2]).toEqual({ x: 9, y: 0.05 })
})
