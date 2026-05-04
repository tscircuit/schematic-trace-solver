import { describe, expect, test } from "bun:test"
import { SameNetTraceSegmentCombiner } from "lib/solvers/SameNetTraceSegmentCombiner/SameNetTraceSegmentCombiner"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { ConnectivityMap } from "connectivity-map"

/**
 * Test 01: Two horizontal traces from the same net that are close together
 * should be combined into a single trace at the average Y position.
 */
test("SameNetTraceSegmentCombiner01 - combines parallel horizontal traces from same net", () => {
  // Create two horizontal traces at Y=0 and Y=0.05 (within EPS=0.1)
  // They should be combined to Y=0.025
  const traceA: SolvedTracePath = {
    mspPairId: "traceA",
    globalConnNetId: "net1",
    tracePath: [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ],
    connectedPinIds: ["pin1", "pin2"],
  }

  const traceB: SolvedTracePath = {
    mspPairId: "traceB",
    globalConnNetId: "net1",
    tracePath: [
      { x: 0.5, y: 0.05 },
      { x: 1.5, y: 0.05 },
    ],
    connectedPinIds: ["pin3", "pin4"],
  }

  const inputProblem: InputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [
      { netId: "net1", pinIds: ["pin1", "pin2", "pin3", "pin4"] },
    ],
    maxMspPairDistance: 5,
  }

  // Create a connectivity map with the correct constructor API
  const connMap = new ConnectivityMap({})
  connMap.addConnections([["pin1", "pin2", "pin3", "pin4"]])

  const combiner = new SameNetTraceSegmentCombiner({
    inputProblem,
    inputTracePaths: [traceA, traceB],
    globalConnMap: connMap,
  })

  combiner.solve()

  const output = combiner.getOutput()
  expect(output.traces.length).toBe(2)

  // Both traces should now have Y at the average (0.025)
  const combinedTraceA = output.traces.find((t) => t.mspPairId === "traceA")!
  const combinedTraceB = output.traces.find((t) => t.mspPairId === "traceB")!

  // Check that Y values have been adjusted to average
  for (const pt of combinedTraceA.tracePath) {
    expect(Math.abs(pt.y - 0.025)).toBeLessThan(1e-6)
  }
  for (const pt of combinedTraceB.tracePath) {
    expect(Math.abs(pt.y - 0.025)).toBeLessThan(1e-6)
  }
})

test("SameNetTraceSegmentCombiner02 - no combination for traces in different nets", () => {
  const traceA: SolvedTracePath = {
    mspPairId: "traceA",
    globalConnNetId: "net1",
    tracePath: [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ],
    connectedPinIds: ["pin1", "pin2"],
  }

  const traceB: SolvedTracePath = {
    mspPairId: "traceB",
    globalConnNetId: "net2",
    tracePath: [
      { x: 0.5, y: 0.05 },
      { x: 1.5, y: 0.05 },
    ],
    connectedPinIds: ["pin3", "pin4"],
  }

  const inputProblem: InputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [
      { netId: "net1", pinIds: ["pin1", "pin2"] },
      { netId: "net2", pinIds: ["pin3", "pin4"] },
    ],
    maxMspPairDistance: 5,
  }

  const connMap = new ConnectivityMap({})
  connMap.addConnections([["pin1", "pin2"]])
  connMap.addConnections([["pin3", "pin4"]])

  const combiner = new SameNetTraceSegmentCombiner({
    inputProblem,
    inputTracePaths: [traceA, traceB],
    globalConnMap: connMap,
  })

  combiner.solve()

  const output = combiner.getOutput()
  // Traces from different nets should NOT be combined
  const combinedTraceA = output.traces.find((t) => t.mspPairId === "traceA")!
  const combinedTraceB = output.traces.find((t) => t.mspPairId === "traceB")!

  // Y values should remain unchanged
  expect(Math.abs(combinedTraceA.tracePath[0]!.y - 0)).toBeLessThan(1e-6)
  expect(Math.abs(combinedTraceB.tracePath[0]!.y - 0.05)).toBeLessThan(1e-6)
})

test("SameNetTraceSegmentCombiner03 - no combination for traces far apart", () => {
  const traceA: SolvedTracePath = {
    mspPairId: "traceA",
    globalConnNetId: "net1",
    tracePath: [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ],
    connectedPinIds: ["pin1", "pin2"],
  }

  const traceB: SolvedTracePath = {
    mspPairId: "traceB",
    globalConnNetId: "net1",
    tracePath: [
      { x: 0.5, y: 0.5 }, // 0.5 apart - beyond EPS=0.1
      { x: 1.5, y: 0.5 },
    ],
    connectedPinIds: ["pin3", "pin4"],
  }

  const inputProblem: InputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [
      { netId: "net1", pinIds: ["pin1", "pin2", "pin3", "pin4"] },
    ],
    maxMspPairDistance: 5,
  }

  const connMap = new ConnectivityMap({})
  connMap.addConnections([["pin1", "pin2", "pin3", "pin4"]])

  const combiner = new SameNetTraceSegmentCombiner({
    inputProblem,
    inputTracePaths: [traceA, traceB],
    globalConnMap: connMap,
  })

  combiner.solve()

  const output = combiner.getOutput()
  const combinedTraceA = output.traces.find((t) => t.mspPairId === "traceA")!
  const combinedTraceB = output.traces.find((t) => t.mspPairId === "traceB")!

  // Traces too far apart should NOT be combined
  expect(Math.abs(combinedTraceA.tracePath[0]!.y - 0)).toBeLessThan(1e-6)
  expect(Math.abs(combinedTraceB.tracePath[0]!.y - 0.5)).toBeLessThan(1e-6)
})
