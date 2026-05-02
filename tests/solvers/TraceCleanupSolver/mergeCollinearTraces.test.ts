import { expect, test } from "bun:test"
import { mergeCollinearTraces } from "lib/solvers/TraceCleanupSolver/mergeCollinearTraces"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

test("mergeCollinearTraces merges two adjacent horizontal segments on same net", () => {
  const trace1: SolvedTracePath = {
    mspPairId: "pair1",
    netId: "VCC",
    tracePath: [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ],
    mspConnectionPairIds: ["pair1"],
    pinIds: ["pin1", "pin2"],
    pinPairId: "pin1-pin2",
  }

  const trace2: SolvedTracePath = {
    mspPairId: "pair2",
    netId: "VCC",
    tracePath: [
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ],
    mspConnectionPairIds: ["pair2"],
    pinIds: ["pin3", "pin4"],
    pinPairId: "pin3-pin4",
  }

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
  const trace1: SolvedTracePath = {
    mspPairId: "pair1",
    netId: "GND",
    tracePath: [
      { x: 0, y: 0 },
      { x: 0, y: 5 },
    ],
    mspConnectionPairIds: ["pair1"],
    pinIds: ["pin1", "pin2"],
    pinPairId: "pin1-pin2",
  }

  const trace2: SolvedTracePath = {
    mspPairId: "pair2",
    netId: "GND",
    tracePath: [
      { x: 0, y: 5 },
      { x: 0, y: 10 },
    ],
    mspConnectionPairIds: ["pair2"],
    pinIds: ["pin3", "pin4"],
    pinPairId: "pin3-pin4",
  }

  const result = mergeCollinearTraces([trace1, trace2])

  expect(result).toHaveLength(1)
  expect(result[0].tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: 5 },
    { x: 0, y: 10 },
  ])
})

test("mergeCollinearTraces does not merge traces with different net IDs", () => {
  const trace1: SolvedTracePath = {
    mspPairId: "pair1",
    netId: "VCC",
    tracePath: [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ],
    mspConnectionPairIds: ["pair1"],
    pinIds: ["pin1", "pin2"],
    pinPairId: "pin1-pin2",
  }

  const trace2: SolvedTracePath = {
    mspPairId: "pair2",
    netId: "GND",
    tracePath: [
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ],
    mspConnectionPairIds: ["pair2"],
    pinIds: ["pin3", "pin4"],
    pinPairId: "pin3-pin4",
  }

  const result = mergeCollinearTraces([trace1, trace2])

  expect(result).toHaveLength(2)
})

test("mergeCollinearTraces does not merge non-collinear segments", () => {
  const trace1: SolvedTracePath = {
    mspPairId: "pair1",
    netId: "VCC",
    tracePath: [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ],
    mspConnectionPairIds: ["pair1"],
    pinIds: ["pin1", "pin2"],
    pinPairId: "pin1-pin2",
  }

  const trace2: SolvedTracePath = {
    mspPairId: "pair2",
    netId: "VCC",
    tracePath: [
      { x: 0, y: 1 },
      { x: 5, y: 1 },
    ],
    mspConnectionPairIds: ["pair2"],
    pinIds: ["pin3", "pin4"],
    pinPairId: "pin3-pin4",
  }

  const result = mergeCollinearTraces([trace1, trace2])

  expect(result).toHaveLength(2)
})

test("mergeCollinearTraces does not merge non-overlapping and non-adjacent segments", () => {
  const trace1: SolvedTracePath = {
    mspPairId: "pair1",
    netId: "VCC",
    tracePath: [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ],
    mspConnectionPairIds: ["pair1"],
    pinIds: ["pin1", "pin2"],
    pinPairId: "pin1-pin2",
  }

  const trace2: SolvedTracePath = {
    mspPairId: "pair2",
    netId: "VCC",
    tracePath: [
      { x: 10, y: 0 },
      { x: 15, y: 0 },
    ],
    mspConnectionPairIds: ["pair2"],
    pinIds: ["pin3", "pin4"],
    pinPairId: "pin3-pin4",
  }

  const result = mergeCollinearTraces([trace1, trace2])

  expect(result).toHaveLength(2)
})

test("mergeCollinearTraces does not merge non-adjacent collinear segments", () => {
  const trace1: SolvedTracePath = {
    mspPairId: "pair1",
    netId: "VCC",
    tracePath: [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ],
    mspConnectionPairIds: ["pair1"],
    pinIds: ["pin1", "pin2"],
    pinPairId: "pin1-pin2",
  }

  const trace2: SolvedTracePath = {
    mspPairId: "pair2",
    netId: "VCC",
    tracePath: [
      { x: 10, y: 0 },
      { x: 15, y: 0 },
    ],
    mspConnectionPairIds: ["pair2"],
    pinIds: ["pin3", "pin4"],
    pinPairId: "pin3-pin4",
  }

  const result = mergeCollinearTraces([trace1, trace2])

  expect(result).toHaveLength(2)
})
