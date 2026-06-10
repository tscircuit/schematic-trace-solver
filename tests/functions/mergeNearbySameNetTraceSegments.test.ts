import { expect, test } from "bun:test"
import { mergeNearbySameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/mergeNearbySameNetTraceSegments"
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
    pins: [
      { pinId: `${mspPairId}-a`, chipId: "chip-a", x: 0, y: 0 },
      { pinId: `${mspPairId}-b`, chipId: "chip-b", x: 5, y: 0 },
    ],
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [`${mspPairId}-a`, `${mspPairId}-b`],
  }) as SolvedTracePath

test("aligns close horizontal segments on the same net", () => {
  const [firstTrace, secondTrace] = mergeNearbySameNetTraceSegments(
    [
      makeTrace("trace-1", "net-a", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 5, y: 1 },
        { x: 5, y: 0 },
      ]),
      makeTrace("trace-2", "net-a", [
        { x: 0, y: 2 },
        { x: 0, y: 1.1 },
        { x: 5, y: 1.1 },
        { x: 5, y: 2 },
      ]),
    ],
    { mergeDistance: 0.2 },
  )

  expect(firstTrace!.tracePath[1]!.y).toBeCloseTo(1.05)
  expect(firstTrace!.tracePath[2]!.y).toBeCloseTo(1.05)
  expect(secondTrace!.tracePath[1]!.y).toBeCloseTo(1.05)
  expect(secondTrace!.tracePath[2]!.y).toBeCloseTo(1.05)
  expect(firstTrace!.tracePath[0]).toEqual({ x: 0, y: 0 })
  expect(secondTrace!.tracePath[3]).toEqual({ x: 5, y: 2 })
})

test("does not align close segments on different nets", () => {
  const [firstTrace, secondTrace] = mergeNearbySameNetTraceSegments(
    [
      makeTrace("trace-1", "net-a", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 5, y: 1 },
        { x: 5, y: 0 },
      ]),
      makeTrace("trace-2", "net-b", [
        { x: 0, y: 2 },
        { x: 0, y: 1.1 },
        { x: 5, y: 1.1 },
        { x: 5, y: 2 },
      ]),
    ],
    { mergeDistance: 0.2 },
  )

  expect(firstTrace!.tracePath[1]!.y).toBe(1)
  expect(secondTrace!.tracePath[1]!.y).toBe(1.1)
})

test("aligns close vertical segments on the same net", () => {
  const [firstTrace, secondTrace] = mergeNearbySameNetTraceSegments(
    [
      makeTrace("trace-1", "net-a", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 5 },
        { x: 0, y: 5 },
      ]),
      makeTrace("trace-2", "net-a", [
        { x: 2, y: 0 },
        { x: 1.1, y: 0 },
        { x: 1.1, y: 5 },
        { x: 2, y: 5 },
      ]),
    ],
    { mergeDistance: 0.2 },
  )

  expect(firstTrace!.tracePath[1]!.x).toBeCloseTo(1.05)
  expect(firstTrace!.tracePath[2]!.x).toBeCloseTo(1.05)
  expect(secondTrace!.tracePath[1]!.x).toBeCloseTo(1.05)
  expect(secondTrace!.tracePath[2]!.x).toBeCloseTo(1.05)
})
