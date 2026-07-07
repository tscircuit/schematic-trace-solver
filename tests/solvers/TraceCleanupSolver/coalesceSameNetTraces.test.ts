import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { coalesceSameNetTraces } from "lib/solvers/TraceCleanupSolver/coalesceSameNetTraces"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: SolvedTracePath["tracePath"],
): SolvedTracePath =>
  ({
    mspPairId,
    globalConnNetId,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    pins: [],
  }) as unknown as SolvedTracePath

test("coalesces close overlapping internal same-net segments", () => {
  const lower = makeTrace("lower", "net1", [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 4, y: 1 },
    { x: 4, y: 0 },
  ])
  const upper = makeTrace("upper", "net1", [
    { x: 0, y: 2 },
    { x: 0, y: 1.12 },
    { x: 4, y: 1.12 },
    { x: 4, y: 2 },
  ])

  const result = coalesceSameNetTraces([lower, upper])

  expect(result.coalescedSegmentCount).toBe(1)
  expect(result.traces[1]!.tracePath).toEqual([
    { x: 0, y: 2 },
    { x: 0, y: 1 },
    { x: 4, y: 1 },
    { x: 4, y: 2 },
  ])
})

test("trims redundant endpoint overlap already covered by same-net trace", () => {
  const shortBranch = makeTrace("short", "net1", [
    { x: 0, y: 0 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
  ])
  const trunk = makeTrace("trunk", "net1", [
    { x: 0, y: 0 },
    { x: 0, y: 5 },
    { x: 1, y: 5 },
  ])

  const result = coalesceSameNetTraces([shortBranch, trunk])

  expect(result.coalescedSegmentCount).toBe(1)
  expect(result.traces[0]!.tracePath).toEqual([
    { x: 0, y: 2 },
    { x: 1, y: 2 },
  ])
})

test("does not coalesce close overlapping segments from different nets", () => {
  const lower = makeTrace("lower", "net1", [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 4, y: 1 },
    { x: 4, y: 0 },
  ])
  const upper = makeTrace("upper", "net2", [
    { x: 0, y: 2 },
    { x: 0, y: 1.12 },
    { x: 4, y: 1.12 },
    { x: 4, y: 2 },
  ])

  const result = coalesceSameNetTraces([lower, upper])

  expect(result.coalescedSegmentCount).toBe(0)
  expect(result.traces[1]!.tracePath).toEqual(upper.tracePath)
})

test("rejects same-net coalescing that would cross a different net", () => {
  const lower = makeTrace("lower", "net1", [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 4, y: 1 },
    { x: 4, y: 0 },
  ])
  const upper = makeTrace("upper", "net1", [
    { x: 0, y: 2 },
    { x: 0, y: 1.12 },
    { x: 4, y: 1.12 },
    { x: 4, y: 2 },
  ])
  const blocker = makeTrace("blocker", "net2", [
    { x: 2, y: 0.9 },
    { x: 2, y: 1.05 },
  ])

  const result = coalesceSameNetTraces([lower, upper, blocker])

  expect(result.coalescedSegmentCount).toBe(0)
  expect(result.traces[1]!.tracePath).toEqual(upper.tracePath)
})
