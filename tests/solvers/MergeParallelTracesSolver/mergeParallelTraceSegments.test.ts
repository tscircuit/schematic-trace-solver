import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { mergeParallelTraceSegments } from "lib/solvers/MergeParallelTracesSolver/mergeParallelTraceSegments"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [
      { pinId: `${mspPairId}-a`, chipId: "U1", ...tracePath[0]! },
      {
        pinId: `${mspPairId}-b`,
        chipId: "U1",
        ...tracePath[tracePath.length - 1]!,
      },
    ],
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [`${mspPairId}-a`, `${mspPairId}-b`],
  }) as SolvedTracePath

test("snaps nearby internal same-net horizontal segments onto the same y", () => {
  const [first, second] = mergeParallelTraceSegments([
    makeTrace("trace-a", "net-1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 0 },
    ]),
    makeTrace("trace-b", "net-1", [
      { x: 0, y: 0.12 },
      { x: 0, y: 1.12 },
      { x: 4, y: 1.12 },
      { x: 4, y: 0.12 },
    ]),
  ])

  expect(first!.tracePath[1]!.y).toBe(1)
  expect(first!.tracePath[2]!.y).toBe(1)
  expect(second!.tracePath[1]!.y).toBe(1)
  expect(second!.tracePath[2]!.y).toBe(1)
  expect(second!.tracePath[0]!.y).toBe(0.12)
  expect(second!.tracePath[3]!.y).toBe(0.12)
})

test("snaps nearby internal same-net vertical segments onto the same x", () => {
  const [first, second] = mergeParallelTraceSegments([
    makeTrace("trace-a", "net-1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 4 },
      { x: 0, y: 4 },
    ]),
    makeTrace("trace-b", "net-1", [
      { x: 0.12, y: 0 },
      { x: 1.12, y: 0 },
      { x: 1.12, y: 4 },
      { x: 0.12, y: 4 },
    ]),
  ])

  expect(first!.tracePath[1]!.x).toBe(1)
  expect(first!.tracePath[2]!.x).toBe(1)
  expect(second!.tracePath[1]!.x).toBe(1)
  expect(second!.tracePath[2]!.x).toBe(1)
  expect(second!.tracePath[0]!.x).toBe(0.12)
  expect(second!.tracePath[3]!.x).toBe(0.12)
})

test("merges two close parallel same-net traces into one", () => {
  const result = mergeParallelTraceSegments([
    makeTrace("trace-a", "net-1", [
      { x: 0, y: 1 },
      { x: 4, y: 1 },
    ]),
    makeTrace("trace-b", "net-1", [
      { x: 0, y: 1.1 },
      { x: 4, y: 1.1 },
    ]),
  ])

  expect(result).toHaveLength(1)
  expect(result[0]!.tracePath).toEqual([
    { x: 0, y: 1 },
    { x: 4, y: 1 },
  ])
  expect(result[0]!.globalConnNetId).toBe("net-1")
  expect(result[0]!.mspConnectionPairIds).toEqual(["trace-a", "trace-b"])
  expect(result[0]!.pinIds).toEqual([
    "trace-a-a",
    "trace-a-b",
    "trace-b-a",
    "trace-b-b",
  ])
})

test("merges two close parallel vertical same-net traces into one", () => {
  const result = mergeParallelTraceSegments([
    makeTrace("trace-a", "net-1", [
      { x: 2, y: 0 },
      { x: 2, y: 5 },
    ]),
    makeTrace("trace-b", "net-1", [
      { x: 2.12, y: 0 },
      { x: 2.12, y: 5 },
    ]),
  ])

  expect(result).toHaveLength(1)
  expect(result[0]!.tracePath).toEqual([
    { x: 2, y: 0 },
    { x: 2, y: 5 },
  ])
})

test("does not snap nearby segments from different nets", () => {
  const [first, second] = mergeParallelTraceSegments([
    makeTrace("trace-a", "net-1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 0 },
    ]),
    makeTrace("trace-b", "net-2", [
      { x: 0, y: 0.12 },
      { x: 0, y: 1.12 },
      { x: 4, y: 1.12 },
      { x: 4, y: 0.12 },
    ]),
  ])

  expect(first!.tracePath[1]!.y).toBe(1)
  expect(first!.tracePath[2]!.y).toBe(1)
  expect(second!.tracePath[1]!.y).toBe(1.12)
  expect(second!.tracePath[2]!.y).toBe(1.12)
})
