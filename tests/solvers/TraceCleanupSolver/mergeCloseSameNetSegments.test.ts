import { expect, test } from "bun:test"
import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { mergeCloseSameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/mergeCloseSameNetSegments"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Point[],
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    mspConnectionPairIds: [mspPairId],
    pinIds: [`${mspPairId}-a`, `${mspPairId}-b`],
    pins: [
      { chipId: "U1", pinId: `${mspPairId}-a`, ...tracePath[0]! },
      {
        chipId: "U2",
        pinId: `${mspPairId}-b`,
        ...tracePath[tracePath.length - 1]!,
      },
    ],
    tracePath,
  }) as SolvedTracePath

test("aligns close same-net interior trace segments", () => {
  const traces = [
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 2 },
      { x: 4, y: 2 },
      { x: 4, y: 0 },
    ]),
    makeTrace("b", "net1", [
      { x: 0.5, y: 0.25 },
      { x: 0.5, y: 2.12 },
      { x: 3.8, y: 2.12 },
      { x: 3.8, y: 0.25 },
    ]),
    makeTrace("c", "net2", [
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 2.1 },
      { x: 3.8, y: 2.1 },
      { x: 3.8, y: 0.5 },
    ]),
  ]

  const merged = mergeCloseSameNetTraceSegments(traces, { maxOffset: 0.2 })

  expect(merged[1]!.tracePath[1]!.y).toBe(2)
  expect(merged[1]!.tracePath[2]!.y).toBe(2)
  expect(merged[1]!.tracePath[0]!.y).toBe(0.25)
  expect(merged[1]!.tracePath[3]!.y).toBe(0.25)

  expect(merged[2]!.tracePath[1]!.y).toBe(2.1)
  expect(merged[2]!.tracePath[2]!.y).toBe(2.1)
})

test("does not move terminal same-net segments because that would move pins", () => {
  const traces = [
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    makeTrace("b", "net1", [
      { x: 0, y: 0.1 },
      { x: 4, y: 0.1 },
    ]),
  ]

  const merged = mergeCloseSameNetTraceSegments(traces, { maxOffset: 0.2 })

  expect(merged[0]!.tracePath).toEqual(traces[0]!.tracePath)
  expect(merged[1]!.tracePath).toEqual(traces[1]!.tracePath)
})
