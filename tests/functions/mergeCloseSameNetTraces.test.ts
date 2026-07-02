import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { mergeCloseSameNetTraces } from "lib/solvers/TraceCleanupSolver/mergeCloseSameNetTraces"

const makeTrace = (
  id: string,
  globalConnNetId: string,
  tracePath: SolvedTracePath["tracePath"],
): SolvedTracePath =>
  ({
    mspPairId: id,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    mspConnectionPairIds: [id],
    pinIds: [`${id}-a`, `${id}-b`],
    pins: [] as any,
    tracePath,
  }) as SolvedTracePath

test("mergeCloseSameNetTraces merges close collinear traces on the same net", () => {
  const traces = [
    makeTrace("A", "NET1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("B", "NET1", [
      { x: 1.1, y: 0 },
      { x: 2, y: 0 },
    ]),
  ]

  const mergedTraces = mergeCloseSameNetTraces({
    traces,
    maxMergeDistance: 0.2,
  })

  expect(mergedTraces).toHaveLength(1)
  expect(mergedTraces[0]!.globalConnNetId).toBe("NET1")
  expect(mergedTraces[0]!.mspConnectionPairIds).toEqual(["A", "B"])
  expect(mergedTraces[0]!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ])
})

test("mergeCloseSameNetTraces does not merge close traces from different nets", () => {
  const traces = [
    makeTrace("A", "NET1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("B", "NET2", [
      { x: 1.1, y: 0 },
      { x: 2, y: 0 },
    ]),
  ]

  const mergedTraces = mergeCloseSameNetTraces({
    traces,
    maxMergeDistance: 0.2,
  })

  expect(mergedTraces).toHaveLength(2)
})

test("mergeCloseSameNetTraces skips merges that would cross another net", () => {
  const traces = [
    makeTrace("A", "NET1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("B", "NET1", [
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]),
    makeTrace("C", "NET2", [
      { x: 1.5, y: -1 },
      { x: 1.5, y: 1 },
    ]),
  ]

  const mergedTraces = mergeCloseSameNetTraces({
    traces,
    maxMergeDistance: 1,
  })

  expect(mergedTraces).toHaveLength(3)
})

test("mergeCloseSameNetTraces continues after skipping a blocked merge", () => {
  const traces = [
    makeTrace("A", "NET1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("B", "NET1", [
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]),
    makeTrace("C", "NET1", [
      { x: 3.1, y: 0 },
      { x: 4, y: 0 },
    ]),
    makeTrace("D", "NET2", [
      { x: 1.5, y: -1 },
      { x: 1.5, y: 1 },
    ]),
  ]

  const mergedTraces = mergeCloseSameNetTraces({
    traces,
    maxMergeDistance: 1,
  })

  expect(mergedTraces).toHaveLength(3)
  expect(mergedTraces.some((trace) => trace.mspPairId === "B+C")).toBe(true)
})
