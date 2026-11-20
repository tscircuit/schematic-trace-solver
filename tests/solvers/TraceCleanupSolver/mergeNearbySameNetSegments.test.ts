import { expect, test } from "bun:test"
import { mergeNearbySameNetSegments } from "lib/solvers/TraceCleanupSolver/mergeNearbySameNetSegments"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { ConnectivityMap } from "connectivity-map"

test("mergeNearbySameNetSegments merges parallel segments of the same net within distance", () => {
  const connMap = new ConnectivityMap({
    net1: ["pair1", "pair2"],
  })

  const trace1: SolvedTracePath = {
    mspPairId: "pair1",
    tracePath: [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 5, y: 1 },
      { x: 5, y: 0 },
    ],
  } as any

  const trace2: SolvedTracePath = {
    mspPairId: "pair2",
    tracePath: [
      { x: 0, y: 0 },
      { x: 0, y: 1.04 },
      { x: 5, y: 1.04 },
      { x: 5, y: 0 },
    ],
  } as any

  const traces = new Map<string, SolvedTracePath>([
    ["pair1", trace1],
    ["pair2", trace2],
  ])

  const merged = mergeNearbySameNetSegments({
    traces,
    connMap,
    maxMergeDistance: 0.06,
  })

  const mergedTrace2 = merged.get("pair2")!
  expect(mergedTrace2.tracePath[1]!.y).toBe(1)
  expect(mergedTrace2.tracePath[2]!.y).toBe(1)
})
