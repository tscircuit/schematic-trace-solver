import { test, expect } from "bun:test"
import { removeNetSegmentDuplicates } from "lib/utils/removeNetSegmentDuplicates"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

function makeTrace(
  overrides: Partial<SolvedTracePath> & {
    mspPairId: string
    tracePath: { x: number; y: number }[]
    globalConnNetId: string
  },
): SolvedTracePath {
  return {
    dcConnNetId: overrides.globalConnNetId,
    mspConnectionPairIds: [overrides.mspPairId],
    pinIds: [],
    pins: [] as any,
    ...overrides,
  } as SolvedTracePath
}

test("removeNetSegmentDuplicates removes shared segment in same net", () => {
  const trace1 = makeTrace({
    mspPairId: "t1",
    globalConnNetId: "net1",
    tracePath: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ],
  })

  const trace2 = makeTrace({
    mspPairId: "t2",
    globalConnNetId: "net1",
    tracePath: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: -1 },
    ],
  })

  const result = removeNetSegmentDuplicates([trace1, trace2])
  expect(result).toHaveLength(2)

  // trace1 (primary) should be unchanged
  expect(result[0].tracePath).toEqual(trace1.tracePath)

  // trace2 should have the shared segment (0,0)->(1,0) removed
  const t2 = result[1]
  // The duplicate segment from (0,0) to (1,0) is skipped,
  // so the path starts at (0,0) then jumps to (1,-1)
  expect(t2.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: -1 },
  ])
})

test("removeNetSegmentDuplicates does not affect different nets", () => {
  const trace1 = makeTrace({
    mspPairId: "t1",
    globalConnNetId: "net1",
    tracePath: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
  })

  const trace2 = makeTrace({
    mspPairId: "t2",
    globalConnNetId: "net2",
    tracePath: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
  })

  const result = removeNetSegmentDuplicates([trace1, trace2])
  expect(result).toHaveLength(2)
  expect(result[0].tracePath).toEqual(trace1.tracePath)
  expect(result[1].tracePath).toEqual(trace2.tracePath)
})

test("removeNetSegmentDuplicates handles single trace", () => {
  const trace = makeTrace({
    mspPairId: "t1",
    globalConnNetId: "net1",
    tracePath: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
  })

  const result = removeNetSegmentDuplicates([trace])
  expect(result).toHaveLength(1)
  expect(result[0].tracePath).toEqual(trace.tracePath)
})
