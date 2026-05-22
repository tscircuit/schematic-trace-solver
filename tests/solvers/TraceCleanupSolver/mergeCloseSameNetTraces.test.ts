import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { mergeTwoSameNetTraces, mergeCloseSameNetTraceGroups } from "../../../lib/solvers/TraceCleanupSolver/sub-solver/mergeCloseSameNetTraces"
import type { CloseSameNetTraceGroup } from "../../../lib/solvers/TraceCleanupSolver/sub-solver/findCloseSameNetTraceGroups"

const makeTrace = (
  mspPairId: string,
  points: { x: number; y: number }[],
): SolvedTracePath => ({
  mspPairId,
  tracePath: points,
  mspConnectionPairIds: [],
  pinIds: [],
  netWithTraceCount: 0,
  globalConnNetId: "net1",
}) as SolvedTracePath

test("mergeTwoSameNetTraces merges horizontally adjacent traces", () => {
  const traceA = makeTrace("a", [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ])
  const traceB = makeTrace("b", [
    { x: 3, y: 0 },
    { x: 5, y: 0 },
  ])

  const result = mergeTwoSameNetTraces(traceA, traceB, 2)
  expect(result).not.toBeNull()
  expect(result!.length).toBeGreaterThan(0)
  // First point should match traceA start
  expect(result![0]).toEqual({ x: 0, y: 0 })
  // Last point should match traceB end
  expect(result![result!.length - 1]).toEqual({ x: 5, y: 0 })
})

test("mergeTwoSameNetTraces returns null when traces are too far apart", () => {
  const traceA = makeTrace("a", [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ])
  const traceB = makeTrace("b", [
    { x: 10, y: 0 },
    { x: 12, y: 0 },
  ])

  const result = mergeTwoSameNetTraces(traceA, traceB, 0.5)
  expect(result).toBeNull()
})

test("mergeTwoSameNetTraces merges touching endpoints directly", () => {
  const traceA = makeTrace("a", [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ])
  const traceB = makeTrace("b", [
    { x: 2, y: 0 },
    { x: 4, y: 0 },
  ])

  const result = mergeTwoSameNetTraces(traceA, traceB, 0.5)
  expect(result).not.toBeNull()
  // Should produce a continuous path from 0 to 4
  expect(result![0]).toEqual({ x: 0, y: 0 })
  expect(result![result!.length - 1]).toEqual({ x: 4, y: 0 })
})

test("mergeTwoSameNetTraces merges vertically adjacent traces", () => {
  const traceA = makeTrace("a", [
    { x: 0, y: 0 },
    { x: 0, y: 2 },
  ])
  const traceB = makeTrace("b", [
    { x: 0, y: 3 },
    { x: 0, y: 5 },
  ])

  const result = mergeTwoSameNetTraces(traceA, traceB, 2)
  expect(result).not.toBeNull()
  expect(result![0]).toEqual({ x: 0, y: 0 })
  expect(result![result!.length - 1]).toEqual({ x: 0, y: 5 })
})

test("mergeTwoSameNetTraces handles reversed endpoint matching", () => {
  // Trace B is oriented "backwards" — its merge endpoint is at index [0]
  const traceA = makeTrace("a", [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ])
  const traceB = makeTrace("b", [
    { x: 2, y: 0 },
    { x: 0, y: 2 },
  ])

  const result = mergeTwoSameNetTraces(traceA, traceB, 0.5)
  expect(result).not.toBeNull()
})

test("mergeCloseSameNetTraceGroups processes multiple groups", () => {
  const traces = [
    makeTrace("a", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]),
    makeTrace("b", [
      { x: 3, y: 0 },
      { x: 5, y: 0 },
    ]),
    makeTrace("c", [
      { x: 10, y: 0 },
      { x: 12, y: 0 },
    ]),
  ]

  const groups: CloseSameNetTraceGroup[] = [
    { netId: "net1", traceIds: ["a", "b"], maxEndpointDistance: 1 },
  ]

  const results = mergeCloseSameNetTraceGroups(groups, traces, 2)
  expect(results.length).toBe(1)
  expect(results[0].originalTraceIds).toContain("a")
  expect(results[0].originalTraceIds).toContain("b")
  expect(results[0].netId).toBe("net1")
})

test("mergeCloseSameNetTraceGroups returns empty for single-trace groups", () => {
  const traces = [makeTrace("a", [{ x: 0, y: 0 }, { x: 2, y: 0 }])]
  const groups: CloseSameNetTraceGroup[] = [
    { netId: "net1", traceIds: ["a"], maxEndpointDistance: 0 },
  ]

  const results = mergeCloseSameNetTraceGroups(groups, traces)
  expect(results.length).toBe(0)
})
