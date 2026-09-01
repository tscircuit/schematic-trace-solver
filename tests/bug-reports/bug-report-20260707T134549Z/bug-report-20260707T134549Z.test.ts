import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260707T134549Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260707T134549Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const alignedTraces = solver.sameNetJunctionAlignmentSolver!.outputTraces
  const upperLoop = alignedTraces.find(
    (trace) => trace.mspPairId === "U1.6-U1.4",
  )!
  const lowerLoop = alignedTraces.find(
    (trace) => trace.mspPairId === "U1.8-U1.6",
  )!
  expect(upperLoop.tracePath[1]!.x).toBeCloseTo(lowerLoop.tracePath[1]!.x, 6)

  const batteryProbeTrace = alignedTraces.find(
    (trace) => trace.mspPairId === "IBAT_PROBE.2-R_BAT_SRC.2",
  )!
  const batteryProbeLabelConnector = alignedTraces.find(
    (trace) => trace.mspPairId === "available-net-orientation-20-BAT_PROBE_SRC",
  )!
  expect(batteryProbeLabelConnector.tracePath[1]!.x).toBeCloseTo(
    batteryProbeTrace.tracePath[1]!.x,
    6,
  )
  expect(batteryProbeLabelConnector.tracePath[2]!.x).toBeCloseTo(
    batteryProbeTrace.tracePath[2]!.x,
    6,
  )

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
