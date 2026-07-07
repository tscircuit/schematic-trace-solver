import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { alignCloseSameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/alignCloseSameNetTraceSegments"

const makeTrace = (
  id: string,
  netId: string,
  tracePath: SolvedTracePath["tracePath"],
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

test("aligns close same-net horizontal interior segments", () => {
  const output = alignCloseSameNetTraceSegments(
    [
      makeTrace("a", "VCC", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 2 },
      ]),
      makeTrace("b", "VCC", [
        { x: 0.5, y: 3 },
        { x: 0.5, y: 1.1 },
        { x: 3.5, y: 1.1 },
        { x: 3.5, y: 4 },
      ]),
    ],
    { threshold: 0.15 },
  )

  expect(output[0]!.tracePath[1]!.y).toBeCloseTo(1.05)
  expect(output[0]!.tracePath[2]!.y).toBeCloseTo(1.05)
  expect(output[1]!.tracePath[1]!.y).toBeCloseTo(1.05)
  expect(output[1]!.tracePath[2]!.y).toBeCloseTo(1.05)
})

test("does not align segments from different nets", () => {
  const output = alignCloseSameNetTraceSegments(
    [
      makeTrace("a", "VCC", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 2 },
      ]),
      makeTrace("b", "GND", [
        { x: 0.5, y: 3 },
        { x: 0.5, y: 1.1 },
        { x: 3.5, y: 1.1 },
        { x: 3.5, y: 4 },
      ]),
    ],
    { threshold: 0.15 },
  )

  expect(output[0]!.tracePath[1]!.y).toBe(1)
  expect(output[1]!.tracePath[1]!.y).toBe(1.1)
})

test("keeps fixed endpoint segments connected to their pins", () => {
  const output = alignCloseSameNetTraceSegments(
    [
      makeTrace("a", "VCC", [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 2 },
      ]),
      makeTrace("b", "VCC", [
        { x: 0, y: 0.1 },
        { x: 3, y: 0.1 },
        { x: 3, y: 2 },
      ]),
    ],
    { threshold: 0.15 },
  )

  expect(output[0]!.tracePath[0]!).toEqual({ x: 0, y: 0 })
  expect(output[0]!.tracePath[1]!).toEqual({ x: 3, y: 0 })
  expect(output[1]!.tracePath[0]!).toEqual({ x: 0, y: 0.1 })
  expect(output[1]!.tracePath[1]!).toEqual({ x: 3, y: 0.1 })
})
