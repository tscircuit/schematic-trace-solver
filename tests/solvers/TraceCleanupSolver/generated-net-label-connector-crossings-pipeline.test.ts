import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { findPerpendicularPathCrossings } from "lib/solvers/TraceCleanupSolver/sub-solver/findIntersectionsWithObstacles"
import atmegaInput from "tests/repros/assets/repro-atmega328p-missing-gnd-netlabel.input.json"
import board1273Input from "tests/repros/assets/board-1273-trace-overlap-cycle.input.json"
import groundFallbackInput from "tests/repros/assets/repro-core-ground-inline-label-fallback.input.json"
import pga300Input from "tests/repros/assets/repro-pga300-redundant-ground-traces.input.json"
import trellisInput from "tests/repros/assets/repro-trellis-core-gnd-net-label-overlap.input.json"
import usbPowerInput from "tests/repros/assets/repro-usb-power-vbus-label-detour.input.json"
import wirelessMouseInput from "tests/repros/assets/repro-wireless-mouse-charger-section.input.json"

const fixtures = [
  ["wireless mouse charger", wirelessMouseInput],
  ["Trellis Core rail labels", trellisInput],
  ["USB power VBUS labels", usbPowerInput],
  ["PGA300 ground traces", pga300Input],
  ["board 1273 overlap cycle", board1273Input],
  ["core ground inline fallback", groundFallbackInput],
  ["ATmega328P ground label", atmegaInput],
] as const

const getConnectorCrossings = (
  traces: SolvedTracePath[],
  connectorTraceIds: ReadonlySet<string>,
) => {
  const crossings: string[] = []
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
      if (
        findPerpendicularPathCrossings(
          connector.tracePath,
          otherTrace.tracePath,
          { includeTerminalSegments: true },
        ).length > 0
      ) {
        crossings.push(`${connector.mspPairId}:${otherTrace.mspPairId}`)
      }
    }
  }
  return crossings
}

test.each(fixtures)(
  "resolves generated connector crossings in %s",
  (_name, inputProblem) => {
    const solver = new SchematicTracePipelineSolver(inputProblem as any)

    solver.solve()

    const connectorTraceIds =
      solver.availableNetOrientationSolver!.generatedConnectorTraceIds
    const traces = solver.traceCleanupSolver2!.getOutput().traces
    expect(getConnectorCrossings(traces, connectorTraceIds)).toEqual([])
    expect(
      solver.traceCleanupSolver2!.stats.initialGeneratedConnectorCrossingCount,
    ).toBeGreaterThan(0)
    expect(
      solver.traceCleanupSolver2!.stats
        .remainingGeneratedConnectorCrossingCount,
    ).toBe(0)
  },
)
