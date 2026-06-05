import { expect, test } from "bun:test"
import { mergeNearbySameNetSegments } from "../../../lib/solvers/TraceCleanupSolver/mergeNearbySameNetSegments"

const makeTrace = (
  id: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
) =>
  ({
    mspPairId: id,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [] as any,
    pinIds: [],
    mspConnectionPairIds: [id],
    tracePath,
  }) as any

test("mergeNearbySameNetSegments removes a tiny horizontal same-net jog without moving endpoints", () => {
  const [trace] = mergeNearbySameNetSegments([
    makeTrace("trace-a", "net-a", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 0.04 },
      { x: 4, y: 0.04 },
      { x: 4, y: 1 },
    ]),
  ])

  expect(trace.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 1 },
  ])
})

test("mergeNearbySameNetSegments aligns close same-net internal segments", () => {
  const [referenceTrace, traceToAlign, otherNetTrace] =
    mergeNearbySameNetSegments([
      makeTrace("reference", "net-a", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
      ]),
      makeTrace("same-net", "net-a", [
        { x: 1, y: 2 },
        { x: 1, y: 1.05 },
        { x: 3, y: 1.05 },
        { x: 3, y: 2 },
      ]),
      makeTrace("other-net", "net-b", [
        { x: 1, y: 3 },
        { x: 1, y: 1.05 },
        { x: 3, y: 1.05 },
        { x: 3, y: 3 },
      ]),
    ])

  expect(referenceTrace.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 4, y: 1 },
    { x: 4, y: 0 },
  ])
  expect(traceToAlign.tracePath).toEqual([
    { x: 1, y: 2 },
    { x: 1, y: 1 },
    { x: 3, y: 1 },
    { x: 3, y: 2 },
  ])
  expect(otherNetTrace.tracePath).toEqual([
    { x: 1, y: 3 },
    { x: 1, y: 1.05 },
    { x: 3, y: 1.05 },
    { x: 3, y: 3 },
  ])
})
