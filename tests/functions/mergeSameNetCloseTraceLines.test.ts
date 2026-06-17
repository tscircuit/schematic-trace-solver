import { expect, test } from "bun:test"
import { mergeSameNetCloseTraceLines } from "lib/solvers/TraceCleanupSolver/mergeSameNetCloseTraceLines"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [] as any,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
  }) as SolvedTracePath

test("snaps nearby overlapping horizontal same-net interior segments to the anchor y", () => {
  const [, branch] = mergeSameNetCloseTraceLines(
    [
      makeTrace("anchor", "net1", [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ]),
      makeTrace("branch", "net1", [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 1, y: 0.08 },
        { x: 4, y: 0.08 },
        { x: 4, y: 1 },
        { x: 5, y: 1 },
      ]),
    ],
    { mergeDistance: 0.1 },
  )

  expect(branch!.tracePath).toEqual([
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 1 },
    { x: 5, y: 1 },
  ])
})

test("does not snap nearby segments from different nets", () => {
  const [, branch] = mergeSameNetCloseTraceLines(
    [
      makeTrace("anchor", "net1", [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ]),
      makeTrace("branch", "net2", [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 1, y: 0.08 },
        { x: 4, y: 0.08 },
        { x: 4, y: 1 },
        { x: 5, y: 1 },
      ]),
    ],
    { mergeDistance: 0.1 },
  )

  expect(branch!.tracePath[2]!.y).toBe(0.08)
  expect(branch!.tracePath[3]!.y).toBe(0.08)
})

test("snaps nearby overlapping vertical same-net interior segments to the anchor x", () => {
  const [, branch] = mergeSameNetCloseTraceLines(
    [
      makeTrace("anchor", "net1", [
        { x: 2, y: 0 },
        { x: 2, y: 4 },
      ]),
      makeTrace("branch", "net1", [
        { x: 3, y: 0 },
        { x: 3, y: 1 },
        { x: 2.06, y: 1 },
        { x: 2.06, y: 4 },
        { x: 3, y: 4 },
        { x: 3, y: 5 },
      ]),
    ],
    { mergeDistance: 0.1 },
  )

  expect(branch!.tracePath).toEqual([
    { x: 3, y: 0 },
    { x: 3, y: 1 },
    { x: 2, y: 1 },
    { x: 2, y: 4 },
    { x: 3, y: 4 },
    { x: 3, y: 5 },
  ])
})
