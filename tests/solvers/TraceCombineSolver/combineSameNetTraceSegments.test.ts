import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { combineSameNetTraceSegments } from "lib/solvers/TraceCombineSolver/combineSameNetTraceSegments"

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
  const [first, second] = combineSameNetTraceSegments([
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

test("merges two close parallel same-net traces into one", () => {
  const result = combineSameNetTraceSegments([
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
})

test("does not combine nearby segments from different nets", () => {
  const [first, second] = combineSameNetTraceSegments([
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
  expect(second!.tracePath[1]!.y).toBe(1.12)
})
