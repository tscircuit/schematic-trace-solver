import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { mergeCollinearTraces } from "lib/solvers/TraceCleanupSolver/mergeCollinearTraces"

const makeTrace = (
  id: string,
  netId: string,
  path: Array<{ x: number; y: number }>,
): SolvedTracePath => ({
  mspPairId: id,
  dcConnNetId: netId,
  globalConnNetId: netId,
  pins: [] as any,
  tracePath: path,
  mspConnectionPairIds: [id],
  pinIds: [],
})

test("mergeCollinearTraces merges two adjacent horizontal segments on same net", () => {
  const trace1 = makeTrace("pair1", "VCC", [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
  ])
  const trace2 = makeTrace("pair2", "VCC", [
    { x: 5, y: 0 },
    { x: 10, y: 0 },
  ])

  const result = mergeCollinearTraces([trace1, trace2])

  expect(result).toHaveLength(1)
  expect(result[0].tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 10, y: 0 },
  ])
  expect(result[0].mspConnectionPairIds).toContain("pair1")
  expect(result[0].mspConnectionPairIds).toContain("pair2")
})

test("mergeCollinearTraces merges two adjacent vertical segments on same net", () => {
  const trace1 = makeTrace("pair1", "GND", [
    { x: 0, y: 0 },
    { x: 0, y: 5 },
  ])
  const trace2 = makeTrace("pair2", "GND", [
    { x: 0, y: 5 },
    { x: 0, y: 10 },
  ])

  const result = mergeCollinearTraces([trace1, trace2])

  expect(result).toHaveLength(1)
  expect(result[0].tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: 5 },
    { x: 0, y: 10 },
  ])
})

test("mergeCollinearTraces does not merge traces with different net IDs", () => {
  const trace1 = makeTrace("pair1", "VCC", [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
  ])
  const trace2 = makeTrace("pair2", "GND", [
    { x: 5, y: 0 },
    { x: 10, y: 0 },
  ])

  const result = mergeCollinearTraces([trace1, trace2])

  expect(result).toHaveLength(2)
})

test("mergeCollinearTraces does not merge non-collinear segments", () => {
  const trace1 = makeTrace("pair1", "VCC", [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
  ])
  const trace2 = makeTrace("pair2", "VCC", [
    { x: 0, y: 1 },
    { x: 5, y: 1 },
  ])

  const result = mergeCollinearTraces([trace1, trace2])

  expect(result).toHaveLength(2)
})

test("mergeCollinearTraces does not merge non-overlapping and non-adjacent segments", () => {
  const trace1 = makeTrace("pair1", "VCC", [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
  ])
  const trace2 = makeTrace("pair2", "VCC", [
    { x: 10, y: 0 },
    { x: 15, y: 0 },
  ])

  const result = mergeCollinearTraces([trace1, trace2])

  expect(result).toHaveLength(2)
})

test("mergeCollinearTraces merges multiple adjacent segments", () => {
  const trace1 = makeTrace("pair1", "VCC", [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
  ])
  const trace2 = makeTrace("pair2", "VCC", [
    { x: 5, y: 0 },
    { x: 10, y: 0 },
  ])
  const trace3 = makeTrace("pair3", "VCC", [
    { x: 10, y: 0 },
    { x: 15, y: 0 },
  ])

  const result = mergeCollinearTraces([trace1, trace2, trace3])

  expect(result).toHaveLength(1)
  expect(result[0].tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 10, y: 0 },
    { x: 15, y: 0 },
  ])
})

test("mergeCollinearTraces does not merge non-adjacent collinear segments", () => {
  const trace1 = makeTrace("pair1", "VCC", [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
  ])
  const trace2 = makeTrace("pair2", "VCC", [
    { x: 10, y: 0 },
    { x: 15, y: 0 },
  ])

  const result = mergeCollinearTraces([trace1, trace2])

  expect(result).toHaveLength(2)
})
