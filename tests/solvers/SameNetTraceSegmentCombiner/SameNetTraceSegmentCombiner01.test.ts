import { describe, expect, test } from "bun:test"
import { SameNetTraceSegmentCombiner } from "lib/solvers/SameNetTraceSegmentCombiner/SameNetTraceSegmentCombiner"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { ConnectivityMap } from "connectivity-map"

const makeTrace = (
  id: string,
  netId: string,
  path: { x: number; y: number }[],
  pIds: string[],
): SolvedTracePath =>
  ({
    mspPairId: id,
    globalConnNetId: netId,
    dcConnNetId: netId,
    tracePath: path,
    mspConnectionPairIds: [id],
    pinIds: pIds,
    pins: [
      { pinId: pIds[0] ?? "p0", x: path[0]!.x, y: path[0]!.y, chipId: "chip1" },
      {
        pinId: pIds[1] ?? "p1",
        x: path[path.length - 1]!.x,
        y: path[path.length - 1]!.y,
        chipId: "chip2",
      },
    ],
  }) as SolvedTracePath

/**
 * Test 01: Two horizontal traces from the same net that are close together
 * should be combined into a single trace at the average Y position.
 */
test("SameNetTraceSegmentCombiner01 - combines parallel horizontal traces from same net", () => {
  const traceA = makeTrace(
    "traceA",
    "net1",
    [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ],
    ["pin1", "pin2"],
  )
  const traceB = makeTrace(
    "traceB",
    "net1",
    [
      { x: 0.5, y: 0.05 },
      { x: 1.5, y: 0.05 },
    ],
    ["pin3", "pin4"],
  )

  const inputProblem: InputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [
      { netId: "net1", pinIds: ["pin1", "pin2", "pin3", "pin4"] },
    ],
    maxMspPairDistance: 5,
    availableNetLabelOrientations: {},
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
  expect(output.traces.length).toBe(2)

  const combinedTraceA = output.traces.find((t) => t.mspPairId === "traceA")!
  const combinedTraceB = output.traces.find((t) => t.mspPairId === "traceB")!

  for (const pt of combinedTraceA.tracePath) {
    expect(Math.abs(pt.y - 0.025)).toBeLessThan(1e-6)
  }
  for (const pt of combinedTraceB.tracePath) {
    expect(Math.abs(pt.y - 0.025)).toBeLessThan(1e-6)
  }
})

test("SameNetTraceSegmentCombiner02 - no combination for traces in different nets", () => {
  const traceA = makeTrace(
    "traceA",
    "net1",
    [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ],
    ["pin1", "pin2"],
  )
  const traceB = makeTrace(
    "traceB",
    "net2",
    [
      { x: 0.5, y: 0.05 },
      { x: 1.5, y: 0.05 },
    ],
    ["pin3", "pin4"],
  )

  const inputProblem: InputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [
      { netId: "net1", pinIds: ["pin1", "pin2"] },
      { netId: "net2", pinIds: ["pin3", "pin4"] },
    ],
    maxMspPairDistance: 5,
    availableNetLabelOrientations: {},
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
  const combinedTraceA = output.traces.find((t) => t.mspPairId === "traceA")!
  const combinedTraceB = output.traces.find((t) => t.mspPairId === "traceB")!

  expect(Math.abs(combinedTraceA.tracePath[0]!.y - 0)).toBeLessThan(1e-6)
  expect(Math.abs(combinedTraceB.tracePath[0]!.y - 0.05)).toBeLessThan(1e-6)
})

test("SameNetTraceSegmentCombiner03 - no combination for traces far apart", () => {
  const traceA = makeTrace(
    "traceA",
    "net1",
    [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ],
    ["pin1", "pin2"],
  )
  const traceB = makeTrace(
    "traceB",
    "net1",
    [
      { x: 0.5, y: 0.5 },
      { x: 1.5, y: 0.5 },
    ],
    ["pin3", "pin4"],
  )

  const inputProblem: InputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [
      { netId: "net1", pinIds: ["pin1", "pin2", "pin3", "pin4"] },
    ],
    maxMspPairDistance: 5,
    availableNetLabelOrientations: {},
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

  expect(Math.abs(combinedTraceA.tracePath[0]!.y - 0)).toBeLessThan(1e-6)
  expect(Math.abs(combinedTraceB.tracePath[0]!.y - 0.5)).toBeLessThan(1e-6)
})
