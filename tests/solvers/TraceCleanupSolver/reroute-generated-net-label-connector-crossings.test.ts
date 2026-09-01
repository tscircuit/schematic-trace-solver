import { expect, test } from "bun:test"
import { getPathLength } from "lib/solvers/Example28Solver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { rerouteGeneratedNetLabelConnectorCrossings } from "lib/solvers/TraceCleanupSolver/rerouteGeneratedNetLabelConnectorCrossings"
import { findPerpendicularPathCrossings } from "lib/solvers/TraceCleanupSolver/sub-solver/findIntersectionsWithObstacles"

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
}): SolvedTracePath => {
  const firstPoint = tracePath[0]!
  const lastPoint = tracePath.at(-1)!
  return {
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [
      {
        pinId: pinIds[0]!,
        chipId: `${mspPairId}-start-chip`,
        ...firstPoint,
      },
      {
        pinId: pinIds[1] ?? pinIds[0]!,
        chipId: `${mspPairId}-end-chip`,
        ...lastPoint,
      },
    ],
    pinIds,
    mspConnectionPairIds: [mspPairId],
    tracePath,
  }
}

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
  mspPairId: "vbat-label-connector",
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

test("reroutes a component trace through an equally short clean corridor", () => {
  const result = rerouteGeneratedNetLabelConnectorCrossings({
    inputProblem,
    traces: [signalTrace, connectorTrace],
    netLabelPlacements: [vbatLabel as any],
    mergedLabelNetIdMap: {},
    clearance: 0.1,
    eligibleTraceIds: new Set([signalTrace.mspPairId]),
    connectorTraceIds: new Set([connectorTrace.mspPairId]),
  })

  expect(result.reroutedTraceCount).toBe(1)
  expect(result.traces[1]!.tracePath).toEqual(connectorTrace.tracePath)
  expect(getPathLength(result.traces[0]!.tracePath)).toBeLessThanOrEqual(
    getPathLength(signalTrace.tracePath),
  )
  expect(
    findPerpendicularPathCrossings(
      result.traces[0]!.tracePath,
      result.traces[1]!.tracePath,
      { includeTerminalSegments: true },
    ),
  ).toEqual([])
})

test("preserves a crossing when avoiding it would lengthen the routed trace", () => {
  const straightSignal = makeTrace({
    mspPairId: "straight-signal",
    globalConnNetId: "signal-net",
    pinIds: ["signal-a", "signal-b"],
    tracePath: [
      { x: -2, y: 0 },
      { x: 2, y: 0 },
    ],
  })
  const verticalConnector = makeTrace({
    mspPairId: "vertical-label-connector",
    globalConnNetId: "label-net",
    pinIds: ["label-pin"],
    tracePath: [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
    ],
  })

  const result = rerouteGeneratedNetLabelConnectorCrossings({
    inputProblem,
    traces: [straightSignal, verticalConnector],
    netLabelPlacements: [],
    mergedLabelNetIdMap: {},
    clearance: 0.1,
    eligibleTraceIds: new Set([straightSignal.mspPairId]),
    connectorTraceIds: new Set([verticalConnector.mspPairId]),
  })

  expect(result.reroutedTraceCount).toBe(0)
  expect(result.traces[0]!.tracePath).toEqual(straightSignal.tracePath)
})

test("allows crossings between generated label connectors", () => {
  const otherConnector = makeTrace({
    mspPairId: "other-label-connector",
    globalConnNetId: "other-label-net",
    pinIds: ["other-label-pin"],
    tracePath: [
      { x: 2, y: 0 },
      { x: 2, y: 2 },
    ],
  })

  const result = rerouteGeneratedNetLabelConnectorCrossings({
    inputProblem,
    traces: [connectorTrace, otherConnector],
    netLabelPlacements: [vbatLabel as any],
    mergedLabelNetIdMap: {},
    clearance: 0.1,
    connectorTraceIds: new Set([
      connectorTrace.mspPairId,
      otherConnector.mspPairId,
    ]),
  })

  expect(result.reroutedTraceCount).toBe(0)
  expect(result.traces).toEqual([connectorTrace, otherConnector])
})
