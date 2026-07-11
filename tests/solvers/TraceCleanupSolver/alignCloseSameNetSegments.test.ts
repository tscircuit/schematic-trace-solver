import { expect, test } from "bun:test"
import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { alignCloseSameNetSegments } from "lib/solvers/TraceCleanupSolver/alignCloseSameNetSegments"

const makeTrace = (
  id: string,
  netId: string,
  tracePath: Point[],
): SolvedTracePath =>
  ({
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    pins: [
      { pinId: `${id}-pin-a`, chipId: `${id}-chip-a`, ...tracePath[0]! },
      {
        pinId: `${id}-pin-b`,
        chipId: `${id}-chip-b`,
        ...tracePath[tracePath.length - 1]!,
      },
    ],
    tracePath,
    mspConnectionPairIds: [id],
    pinIds: [`${id}-pin-a`, `${id}-pin-b`],
  }) as SolvedTracePath

test("aligns close horizontal same-net internal segments", () => {
  const traces = [
    makeTrace("anchor", "net-a", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 0 },
    ]),
    makeTrace("moving", "net-a", [
      { x: 1, y: 0.2 },
      { x: 1, y: 1.08 },
      { x: 3, y: 1.08 },
      { x: 3, y: 0.2 },
    ]),
  ]

  const [anchor, moving] = alignCloseSameNetSegments({ traces })

  expect(anchor!.tracePath).toEqual(traces[0]!.tracePath)
  expect(moving!.tracePath).toEqual([
    { x: 1, y: 0.2 },
    { x: 1, y: 1 },
    { x: 3, y: 1 },
    { x: 3, y: 0.2 },
  ])
})

test("aligns close vertical same-net internal segments", () => {
  const traces = [
    makeTrace("anchor", "net-a", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 4 },
      { x: 0, y: 4 },
    ]),
    makeTrace("moving", "net-a", [
      { x: 0.2, y: 1 },
      { x: 1.09, y: 1 },
      { x: 1.09, y: 3 },
      { x: 0.2, y: 3 },
    ]),
  ]

  const [, moving] = alignCloseSameNetSegments({ traces })

  expect(moving!.tracePath).toEqual([
    { x: 0.2, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 3 },
    { x: 0.2, y: 3 },
  ])
})

test("does not align close segments on different nets", () => {
  const traces = [
    makeTrace("trace-a", "net-a", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 0 },
    ]),
    makeTrace("trace-b", "net-b", [
      { x: 1, y: 0.2 },
      { x: 1, y: 1.08 },
      { x: 3, y: 1.08 },
      { x: 3, y: 0.2 },
    ]),
  ]

  expect(alignCloseSameNetSegments({ traces })).toEqual(traces)
})

test("does not move terminal-only trace segments", () => {
  const traces = [
    makeTrace("trace-a", "net-a", [
      { x: 0, y: 1 },
      { x: 4, y: 1 },
    ]),
    makeTrace("trace-b", "net-a", [
      { x: 0, y: 1.08 },
      { x: 4, y: 1.08 },
    ]),
  ]

  expect(alignCloseSameNetSegments({ traces })).toEqual(traces)
})

test("rejects same-net alignment that would cross a different net", () => {
  const traces = [
    makeTrace("anchor", "net-a", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 0 },
    ]),
    makeTrace("moving", "net-a", [
      { x: 1, y: 0.2 },
      { x: 1, y: 1.08 },
      { x: 3, y: 1.08 },
      { x: 3, y: 0.2 },
    ]),
    makeTrace("blocker", "net-b", [
      { x: 2, y: 0.8 },
      { x: 2, y: 1.02 },
      { x: 2.5, y: 1.02 },
      { x: 2.5, y: 0.8 },
    ]),
  ]

  const [, moving] = alignCloseSameNetSegments({ traces })

  expect(moving!.tracePath).toEqual(traces[1]!.tracePath)
})

test("still applies later safe alignments when the closest candidate is blocked", () => {
  const traces = [
    makeTrace("blocked-anchor", "net-a", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 0 },
    ]),
    makeTrace("blocked-moving", "net-a", [
      { x: 1, y: 0.2 },
      { x: 1, y: 1.04 },
      { x: 3, y: 1.04 },
      { x: 3, y: 0.2 },
    ]),
    makeTrace("blocker", "net-b", [
      { x: 2, y: 0.8 },
      { x: 2, y: 1.02 },
      { x: 2.5, y: 1.02 },
      { x: 2.5, y: 0.8 },
    ]),
    makeTrace("safe-anchor", "net-a", [
      { x: 5, y: 1 },
      { x: 5, y: 2 },
      { x: 9, y: 2 },
      { x: 9, y: 1 },
    ]),
    makeTrace("safe-moving", "net-a", [
      { x: 6, y: 1.2 },
      { x: 6, y: 2.1 },
      { x: 8, y: 2.1 },
      { x: 8, y: 1.2 },
    ]),
  ]

  const [, blockedMoving, , , safeMoving] = alignCloseSameNetSegments({
    traces,
  })

  expect(blockedMoving!.tracePath).toEqual(traces[1]!.tracePath)
  expect(safeMoving!.tracePath).toEqual([
    { x: 6, y: 1.2 },
    { x: 6, y: 2 },
    { x: 8, y: 2 },
    { x: 8, y: 1.2 },
  ])
})
