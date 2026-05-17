import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { mergeNearbySameNetTraceLines } from "lib/solvers/TraceCleanupSolver/mergeNearbySameNetTraceLines"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: SolvedTracePath["tracePath"],
): SolvedTracePath =>
  ({
    mspPairId,
    globalConnNetId,
    dcConnNetId: globalConnNetId,
    userNetId: globalConnNetId,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    pins: [],
  }) as any

test("mergeNearbySameNetTraceLines aligns close same-net horizontal segments", () => {
  const traces = mergeNearbySameNetTraceLines(
    [
      makeTrace("a", "N1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
      ]),
      makeTrace("b", "N1", [
        { x: 1, y: 0 },
        { x: 1, y: 1.05 },
        { x: 3, y: 1.05 },
        { x: 3, y: 0 },
      ]),
    ],
    0.1,
  )

  expect(traces[1]!.tracePath[1]!.y).toBe(1)
  expect(traces[1]!.tracePath[2]!.y).toBe(1)
})

test("mergeNearbySameNetTraceLines aligns close same-net vertical segments", () => {
  const traces = mergeNearbySameNetTraceLines(
    [
      makeTrace("a", "N1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 4 },
        { x: 0, y: 4 },
      ]),
      makeTrace("b", "N1", [
        { x: 0, y: 1 },
        { x: 1.05, y: 1 },
        { x: 1.05, y: 3 },
        { x: 0, y: 3 },
      ]),
    ],
    0.1,
  )

  expect(traces[1]!.tracePath[1]!.x).toBe(1)
  expect(traces[1]!.tracePath[2]!.x).toBe(1)
})

test("mergeNearbySameNetTraceLines leaves different nets unchanged", () => {
  const traces = mergeNearbySameNetTraceLines(
    [
      makeTrace("a", "N1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
      ]),
      makeTrace("b", "N2", [
        { x: 1, y: 0 },
        { x: 1, y: 1.05 },
        { x: 3, y: 1.05 },
        { x: 3, y: 0 },
      ]),
    ],
    0.1,
  )

  expect(traces[1]!.tracePath[1]!.y).toBe(1.05)
  expect(traces[1]!.tracePath[2]!.y).toBe(1.05)
})

test("mergeNearbySameNetTraceLines rejects moves that overlap a different net", () => {
  const traces = mergeNearbySameNetTraceLines(
    [
      makeTrace("a", "N1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
      ]),
      makeTrace("b", "N1", [
        { x: 1, y: 0 },
        { x: 1, y: 1.05 },
        { x: 3, y: 1.05 },
        { x: 3, y: 0 },
      ]),
      makeTrace("c", "N2", [
        { x: 1.5, y: 2 },
        { x: 1.5, y: 1 },
        { x: 2.5, y: 1 },
        { x: 2.5, y: 2 },
      ]),
    ],
    0.1,
  )

  expect(traces[1]!.tracePath[1]!.y).toBe(1.05)
  expect(traces[1]!.tracePath[2]!.y).toBe(1.05)
})
