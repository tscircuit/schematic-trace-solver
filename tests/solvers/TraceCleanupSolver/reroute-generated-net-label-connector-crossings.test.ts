import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { rerouteGeneratedNetLabelConnectorCrossings } from "lib/solvers/TraceCleanupSolver/rerouteGeneratedNetLabelConnectorCrossings"

const makeTrace = ({
  mspPairId,
  globalConnNetId,
  tracePath,
  pinIds,
}: {
  mspPairId: string
  globalConnNetId: string
  tracePath: Array<{ x: number; y: number }>
  pinIds: string[]
}): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [],
    pinIds,
    mspConnectionPairIds: [mspPairId],
    tracePath,
  }) as SolvedTracePath

const signalTrace = makeTrace({
  mspPairId: "signal-trace",
  globalConnNetId: "signal-net",
  pinIds: ["signal-a", "signal-b"],
  tracePath: [
    { x: 1, y: 3 },
    { x: 2, y: 3 },
    { x: 2, y: 0 },
    { x: -6, y: 0 },
  ],
})

const connectorTrace = makeTrace({
  mspPairId: "available-net-orientation-0-VBAT",
  globalConnNetId: "vbat-net",
  pinIds: ["vbat"],
  tracePath: [
    { x: 3, y: 1 },
    { x: 1.5, y: 1 },
    { x: 1.5, y: 1.5 },
  ],
})

const vbatLabel = {
  globalConnNetId: "vbat-net",
  pinIds: ["vbat"],
  anchorPoint: { x: 1.5, y: 1.5 },
  center: { x: 1.5, y: 1.7 },
  width: 1,
  height: 0.4,
}

const inputProblem = { chips: [], textBoxes: [] } as any

test("routes a generated connector crossing through the open corridor center", () => {
  const result = rerouteGeneratedNetLabelConnectorCrossings({
    inputProblem,
    traces: [signalTrace, connectorTrace],
    netLabelPlacements: [vbatLabel as any],
    clearance: 0.1,
    eligibleTraceIds: new Set([signalTrace.mspPairId]),
  })

  expect(result.reroutedTraceCount).toBe(1)
  expect(result.traces[0]!.tracePath).toEqual([
    { x: 1, y: 3 },
    { x: 2, y: 3 },
    { x: 2, y: 2 },
    { x: -2.55, y: 2 },
    { x: -2.55, y: 0 },
    { x: -6, y: 0 },
  ])
})

test("preserves the established trace when the centered corridor is blocked", () => {
  const blockingTrace = makeTrace({
    mspPairId: "blocking-trace",
    globalConnNetId: "blocking-net",
    pinIds: ["block-a", "block-b"],
    tracePath: [
      { x: -1, y: 1.5 },
      { x: -1, y: 2.5 },
    ],
  })
  const result = rerouteGeneratedNetLabelConnectorCrossings({
    inputProblem,
    traces: [signalTrace, connectorTrace, blockingTrace],
    netLabelPlacements: [vbatLabel as any],
    clearance: 0.1,
    eligibleTraceIds: new Set([signalTrace.mspPairId]),
  })

  expect(result.reroutedTraceCount).toBe(0)
  expect(result.traces[0]!.tracePath).toEqual(signalTrace.tracePath)
})
