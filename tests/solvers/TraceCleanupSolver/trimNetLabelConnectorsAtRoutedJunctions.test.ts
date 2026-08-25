import { expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { trimNetLabelConnectorsAtRoutedJunctions } from "lib/solvers/Example28Solver/trimNetLabelConnectorsAtRoutedJunctions"

const createTrace = (
  mspPairId: string,
  tracePath: SolvedTracePath["tracePath"],
  pinIds: string[],
): SolvedTracePath => ({
  mspPairId,
  globalConnNetId: "ground-net",
  dcConnNetId: mspPairId,
  userNetId: "GND",
  pins: pinIds.map((pinId) => ({
    pinId,
    chipId: "U1",
    x: 0,
    y: 0,
  })),
  tracePath,
  mspConnectionPairIds: [mspPairId],
  pinIds,
})

test("trims a generated connector to the nearest connected routed junction", () => {
  const hostTrace = createTrace(
    "host",
    [
      { x: 1, y: 1 },
      { x: 1.5, y: 1 },
      { x: 1.5, y: 0.5 },
      { x: 1, y: 0.5 },
    ],
    ["U1.1", "U1.2"],
  )
  const connectedTrace = createTrace(
    "connected",
    [
      { x: 1, y: 0 },
      { x: 1.5, y: 0 },
      { x: 1.5, y: 0.5 },
      { x: 1, y: 0.5 },
    ],
    ["U1.2", "U1.3"],
  )
  const unrelatedSameNetTrace = createTrace(
    "unrelated",
    [
      { x: 2.5, y: -1 },
      { x: 2.5, y: 1 },
    ],
    ["U2.1", "U2.2"],
  )
  const connector = createTrace(
    "available-net-orientation-0-GND",
    [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ],
    ["U1.1", "U1.2"],
  )
  const label: NetLabelPlacement = {
    globalConnNetId: "ground-net",
    netId: "GND",
    mspConnectionPairIds: ["host"],
    pinIds: ["U1.1", "U1.2"],
    orientation: "y-",
    anchorPoint: { x: 3, y: 0 },
    center: { x: 3, y: -0.2 },
    width: 0.4,
    height: 0.2,
  }

  const result = trimNetLabelConnectorsAtRoutedJunctions({
    traces: [hostTrace, connectedTrace, unrelatedSameNetTrace, connector],
    netLabelPlacements: [label],
  })

  expect(
    result.find((trace) => trace.mspPairId === connector.mspPairId)?.tracePath,
  ).toEqual([
    { x: 1.5, y: 0 },
    { x: 3, y: 0 },
  ])
  expect(label.anchorPoint).toEqual({ x: 3, y: 0 })
  expect(label.center).toEqual({ x: 3, y: -0.2 })
})

test("keeps the connector when it only overlaps its direct host trace", () => {
  const hostTrace = createTrace(
    "host",
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ],
    ["U1.1", "U1.2"],
  )
  const connector = createTrace(
    "available-net-orientation-0-GND",
    [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ],
    ["U1.1", "U1.2"],
  )
  const label: NetLabelPlacement = {
    globalConnNetId: "ground-net",
    netId: "GND",
    mspConnectionPairIds: ["host"],
    pinIds: ["U1.1", "U1.2"],
    orientation: "y-",
    anchorPoint: { x: 3, y: 0 },
    center: { x: 3, y: -0.2 },
    width: 0.4,
    height: 0.2,
  }

  const result = trimNetLabelConnectorsAtRoutedJunctions({
    traces: [hostTrace, connector],
    netLabelPlacements: [label],
  })

  expect(result).toEqual([hostTrace, connector])
})
