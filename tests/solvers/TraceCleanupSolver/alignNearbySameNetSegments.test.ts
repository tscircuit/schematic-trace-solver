import { expect, test } from "bun:test"
import { alignNearbySameNetSegments } from "lib/solvers/TraceCleanupSolver/alignNearbySameNetSegments"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    globalConnNetId,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    pins: [],
  }) as unknown as SolvedTracePath

test("aligns close internal horizontal same-net segments", () => {
  const traces = alignNearbySameNetSegments([
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 0 },
    ]),
    makeTrace("b", "net1", [
      { x: 1, y: 0 },
      { x: 1, y: 1.08 },
      { x: 3, y: 1.08 },
      { x: 3, y: 0 },
    ]),
  ])

  expect(traces[1]!.tracePath[0]).toEqual({ x: 1, y: 0 })
  expect(traces[1]!.tracePath[1]).toEqual({ x: 1, y: 1 })
  expect(traces[1]!.tracePath[2]).toEqual({ x: 3, y: 1 })
  expect(traces[1]!.tracePath[3]).toEqual({ x: 3, y: 0 })
})

test("aligns close internal vertical same-net segments", () => {
  const traces = alignNearbySameNetSegments([
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 4 },
      { x: 0, y: 4 },
    ]),
    makeTrace("b", "net1", [
      { x: 0, y: 1 },
      { x: 1.08, y: 1 },
      { x: 1.08, y: 3 },
      { x: 0, y: 3 },
    ]),
  ])

  expect(traces[1]!.tracePath[1]).toEqual({ x: 1, y: 1 })
  expect(traces[1]!.tracePath[2]).toEqual({ x: 1, y: 3 })
})

test("does not align endpoint-only trace segments", () => {
  const original = [
    makeTrace("a", "net1", [
      { x: 0, y: 1 },
      { x: 4, y: 1 },
    ]),
    makeTrace("b", "net1", [
      { x: 1, y: 1.08 },
      { x: 3, y: 1.08 },
    ]),
  ]

  expect(alignNearbySameNetSegments(original)).toEqual(original)
})

test("does not align different-net segments", () => {
  const traces = alignNearbySameNetSegments([
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 0 },
    ]),
    makeTrace("b", "net2", [
      { x: 1, y: 0 },
      { x: 1, y: 1.08 },
      { x: 3, y: 1.08 },
      { x: 3, y: 0 },
    ]),
  ])

  expect(traces[1]!.tracePath[1]).toEqual({ x: 1, y: 1.08 })
  expect(traces[1]!.tracePath[2]).toEqual({ x: 3, y: 1.08 })
})

test("does not align segments outside the threshold", () => {
  const traces = alignNearbySameNetSegments([
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 0 },
    ]),
    makeTrace("b", "net1", [
      { x: 1, y: 0 },
      { x: 1, y: 1.3 },
      { x: 3, y: 1.3 },
      { x: 3, y: 0 },
    ]),
  ])

  expect(traces[1]!.tracePath[1]).toEqual({ x: 1, y: 1.3 })
  expect(traces[1]!.tracePath[2]).toEqual({ x: 3, y: 1.3 })
})

test("rejects alignments that introduce a different-net intersection", () => {
  const traces = alignNearbySameNetSegments([
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 0 },
    ]),
    makeTrace("b", "net1", [
      { x: 1, y: 0 },
      { x: 1, y: 1.08 },
      { x: 3, y: 1.08 },
      { x: 3, y: 0 },
    ]),
    makeTrace("c", "net2", [
      { x: 2, y: 0.95 },
      { x: 2, y: 1.05 },
    ]),
  ])

  expect(traces[1]!.tracePath[1]).toEqual({ x: 1, y: 1.08 })
  expect(traces[1]!.tracePath[2]).toEqual({ x: 3, y: 1.08 })
})
