import { expect, test } from "bun:test"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import { removeNetSegmentDuplicates } from "lib/solvers/TraceCleanupSolver/removeNetSegmentDuplicates"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  mspPairId: string,
  tracePath: SolvedTracePath["tracePath"],
  globalConnNetId = "net1",
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [] as any,
    pinIds: [],
    mspConnectionPairIds: [mspPairId],
    tracePath,
  }) as SolvedTracePath

test("simplifyPath removes duplicate consecutive points from post-processing splices", () => {
  expect(
    simplifyPath([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]),
  ).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ])
})

test("removeNetSegmentDuplicates trims same-net duplicate endpoint segments", () => {
  const [firstTrace, secondTrace] = removeNetSegmentDuplicates([
    makeTrace("a", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]),
    makeTrace("b", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]),
  ])

  expect(firstTrace!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ])
  expect(secondTrace!.tracePath).toEqual([
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ])
})

test("removeNetSegmentDuplicates keeps duplicate segments on different nets", () => {
  const traces = removeNetSegmentDuplicates([
    makeTrace(
      "a",
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      "net1",
    ),
    makeTrace(
      "b",
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      "net2",
    ),
  ])

  expect(traces[1]!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ])
})
