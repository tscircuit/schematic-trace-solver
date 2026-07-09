import { expect, test } from "bun:test"
import { combineCloseSameNetTraceGroups } from "lib/solvers/TraceCleanupSolver/sub-solver/combineCloseSameNetTraceGroups"

const trace = (
  id: string,
  netId: string,
  path: Array<{ x: number; y: number }>,
  pinIds = [`${id}-pin-a`, `${id}-pin-b`],
) =>
  ({
    mspPairId: id,
    mspConnectionPairIds: [id],
    pinIds,
    userNetId: netId,
    globalConnNetId: `${netId}-global`,
    dcConnNetId: `${netId}-dc`,
    tracePath: path,
  }) as any

test("combineCloseSameNetTraceGroups merges close same-net traces", () => {
  const combined = combineCloseSameNetTraceGroups(
    [
      trace("a", "N1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      trace("b", "N1", [
        { x: 1.1, y: 0 },
        { x: 2, y: 0 },
      ]),
      trace("c", "N2", [
        { x: 10, y: 10 },
        { x: 11, y: 10 },
      ]),
    ],
    0.2,
  )

  expect(combined).toHaveLength(2)
  const merged = combined.find((candidate) => candidate.mspPairId === "a")!
  expect(merged.mspConnectionPairIds).toEqual(["a", "b"])
  expect(merged.pinIds).toEqual(["a-pin-a", "a-pin-b", "b-pin-a", "b-pin-b"])
  expect(merged.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1.1, y: 0 },
    { x: 2, y: 0 },
  ])
})

test("combineCloseSameNetTraceGroups orients reversed traces before merging", () => {
  const combined = combineCloseSameNetTraceGroups(
    [
      trace("a", "N1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      trace("b", "N1", [
        { x: 2, y: 0 },
        { x: 1, y: 0 },
      ]),
    ],
    0.01,
  )

  expect(combined).toHaveLength(1)
  expect(combined[0].tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ])
})

test("combineCloseSameNetTraceGroups leaves different nets separate", () => {
  const combined = combineCloseSameNetTraceGroups(
    [
      trace("a", "N1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      trace("b", "N2", [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ]),
    ],
    0.01,
  )

  expect(combined.map((candidate) => candidate.mspPairId)).toEqual(["a", "b"])
})
