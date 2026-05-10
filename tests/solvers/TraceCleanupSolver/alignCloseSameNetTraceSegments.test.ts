import { expect, test } from "bun:test"
import { alignCloseSameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/alignCloseSameNetTraceSegments"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const trace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    globalConnNetId,
    dcConnNetId: globalConnNetId,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    pins: [] as any,
    tracePath,
  }) as SolvedTracePath

test("aligns close overlapping internal same-net horizontal segments", () => {
  const output = alignCloseSameNetTraceSegments([
    trace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0.2, y: 0.2 },
      { x: 1.8, y: 0.2 },
      { x: 2, y: 0 },
    ]),
    trace("b", "net1", [
      { x: 0, y: 1 },
      { x: 0.4, y: 0.28 },
      { x: 1.4, y: 0.28 },
      { x: 2, y: 1 },
    ]),
  ])

  expect(output[1]!.tracePath[1]!.y).toBe(0.2)
  expect(output[1]!.tracePath[2]!.y).toBe(0.2)
  expect(output[1]!.tracePath[0]!.y).toBe(1)
  expect(output[1]!.tracePath[3]!.y).toBe(1)
})

test("leaves close different-net segments alone", () => {
  const output = alignCloseSameNetTraceSegments([
    trace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0.2, y: 0.2 },
      { x: 1.8, y: 0.2 },
      { x: 2, y: 0 },
    ]),
    trace("b", "net2", [
      { x: 0, y: 1 },
      { x: 0.4, y: 0.28 },
      { x: 1.4, y: 0.28 },
      { x: 2, y: 1 },
    ]),
  ])

  expect(output[1]!.tracePath[1]!.y).toBe(0.28)
  expect(output[1]!.tracePath[2]!.y).toBe(0.28)
})
