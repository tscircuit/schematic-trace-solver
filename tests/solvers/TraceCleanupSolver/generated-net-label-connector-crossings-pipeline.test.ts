import { expect, test } from "bun:test"
import { getPathLength } from "lib/solvers/Example28Solver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { countTurns } from "lib/solvers/TraceCleanupSolver/countTurns"
import { rerouteGeneratedNetLabelConnectorCrossings } from "lib/solvers/TraceCleanupSolver/rerouteGeneratedNetLabelConnectorCrossings"
import { findPerpendicularPathCrossings } from "lib/solvers/TraceCleanupSolver/sub-solver/findIntersectionsWithObstacles"
import report20260706Input from "tests/bug-reports/bug-report-20260706T213649Z/bug-report-20260706T213649Z.json"
import report20260730Input from "tests/bug-reports/bug-report-20260730T061837Z/bug-report-20260730T061837Z.json"
import report20260805Input from "tests/bug-reports/bug-report-20260805T061316Z/bug-report-20260805T061316Z.json"
import report20260819Input from "tests/bug-reports/bug-report-20260819T091818Z/bug-report-20260819T091818Z.json"
import report20260901Input from "tests/bug-reports/bug-report-20260901T055358Z/bug-report-20260901T055358Z.json"
import example44Input from "tests/assets/example44.json"
import wirelessMouseInput from "tests/repros/assets/repro-wireless-mouse-charger-section.input.json"

const cleanRouteFixtures = [
  ["wireless mouse charger", wirelessMouseInput],
] as const

const regressionFixtures = [
  ["example 44", example44Input],
  ["bug report 20260706", report20260706Input],
  ["bug report 20260730", report20260730Input],
  ["bug report 20260805", report20260805Input],
  ["bug report 20260819", report20260819Input],
  ["bug report 20260901", report20260901Input],
] as const

const getConnectorCrossingCount = (
  traces: SolvedTracePath[],
  connectorTraceIds: ReadonlySet<string>,
) => {
  let crossingCount = 0
  for (const connector of traces.filter((trace) =>
    connectorTraceIds.has(trace.mspPairId),
  )) {
    for (const otherTrace of traces) {
      if (otherTrace.mspPairId === connector.mspPairId) continue
      if (otherTrace.globalConnNetId === connector.globalConnNetId) continue
      if (
        connectorTraceIds.has(otherTrace.mspPairId) &&
        otherTrace.mspPairId < connector.mspPairId
      ) {
        continue
      }
      crossingCount += findPerpendicularPathCrossings(
        connector.tracePath,
        otherTrace.tracePath,
        { includeTerminalSegments: true },
      ).length
    }
  }
  return crossingCount
}

const getRerouteResult = (inputProblem: unknown) => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const connectorTraceIds =
    solver.availableNetOrientationSolver!.generatedConnectorTraceIds
  const preAlignmentOutput =
    solver.preAlignmentTraceElbowTransitionSimplificationSolver!.getOutput()
  const beforeTraces = preAlignmentOutput.traces
  const rerouteResult = rerouteGeneratedNetLabelConnectorCrossings({
    inputProblem: inputProblem as any,
    traces: beforeTraces,
    netLabelPlacements: preAlignmentOutput.netLabelPlacements,
    mergedLabelNetIdMap:
      solver.traceLabelOverlapAvoidanceSolver!.labelMergingSolver!.getOutput()
        .mergedLabelNetIdMap,
    clearance: 0.1,
    eligibleTraceIds: new Set(
      solver
        .traceCleanupSolver!.getOutput()
        .traces.map((trace) => trace.mspPairId),
    ),
    connectorTraceIds,
  })

  return { solver, connectorTraceIds, beforeTraces, rerouteResult }
}

test.each(cleanRouteFixtures)(
  "uses a shortest clean route for generated connector crossings in %s",
  (_name, inputProblem) => {
    const { solver, connectorTraceIds, beforeTraces, rerouteResult } =
      getRerouteResult(inputProblem)
    const afterTraces = rerouteResult.traces
    const beforeTraceMap = new Map(
      beforeTraces.map((trace) => [trace.mspPairId, trace]),
    )
    const changedTraces = afterTraces.filter((trace) => {
      const beforeTrace = beforeTraceMap.get(trace.mspPairId)
      return (
        beforeTrace &&
        JSON.stringify(trace.tracePath) !==
          JSON.stringify(beforeTrace.tracePath)
      )
    })

    expect(changedTraces.length).toBeGreaterThan(0)
    for (const trace of changedTraces) {
      const beforeTrace = beforeTraceMap.get(trace.mspPairId)!
      expect(connectorTraceIds.has(trace.mspPairId)).toBeFalse()
      expect(getPathLength(trace.tracePath)).toBeLessThanOrEqual(
        getPathLength(beforeTrace.tracePath) + 1e-6,
      )
      expect(countTurns(trace.tracePath)).toBeLessThanOrEqual(
        countTurns(beforeTrace.tracePath) + 2,
      )
    }

    const initialCrossingCount = getConnectorCrossingCount(
      beforeTraces,
      connectorTraceIds,
    )
    const remainingCrossingCount = getConnectorCrossingCount(
      afterTraces,
      connectorTraceIds,
    )
    expect(remainingCrossingCount).toBeLessThan(initialCrossingCount)
    expect(
      solver.traceCleanupSolver2!.stats.initialGeneratedConnectorCrossingCount,
    ).toBe(initialCrossingCount)
    expect(
      solver.traceCleanupSolver2!.stats
        .remainingGeneratedConnectorCrossingCount,
    ).toBe(remainingCrossingCount)
    expect(rerouteResult.reroutedTraceCount).toBe(changedTraces.length)
  },
)

test.each(regressionFixtures)(
  "preserves the existing route when crossing removal would regress %s",
  (_name, inputProblem) => {
    const { solver, connectorTraceIds, beforeTraces, rerouteResult } =
      getRerouteResult(inputProblem)

    expect(rerouteResult.reroutedTraceCount).toBe(0)
    expect(rerouteResult.traces).toEqual(beforeTraces)
    expect(
      solver.traceCleanupSolver2!.stats.initialGeneratedConnectorCrossingCount,
    ).toBe(getConnectorCrossingCount(beforeTraces, connectorTraceIds))
    expect(
      solver.traceCleanupSolver2!.stats
        .remainingGeneratedConnectorCrossingCount,
    ).toBe(getConnectorCrossingCount(beforeTraces, connectorTraceIds))
  },
)
