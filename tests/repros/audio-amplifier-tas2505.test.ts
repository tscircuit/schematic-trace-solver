import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "tests/assets/audio-amplifier-tas2505.input.json"
import "tests/fixtures/matcher"

test("repro AudioAmplifier TAS2505 schematic traces", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const firstCapacitorRailTraceId = "schematic_port_32-schematic_port_30"
  const capacitorRailTraceIds = new Set([
    firstCapacitorRailTraceId,
    "schematic_port_5-schematic_port_32",
    "schematic_port_7-schematic_port_5",
    "schematic_port_10-schematic_port_7",
    "schematic_port_34-schematic_port_10",
    "schematic_port_36-schematic_port_34",
  ])
  const firstCapacitorRailY = solver
    .preAlignmentTraceElbowTransitionSimplificationSolver!.getOutput()
    .traces.find((trace) => trace.mspPairId === firstCapacitorRailTraceId)!
    .tracePath[1]!.y
  const capacitorRailYs = solver
    .traceCleanupSolver2!.getOutput()
    .traces.filter((trace) => capacitorRailTraceIds.has(trace.mspPairId))
    .map((trace) => trace.tracePath[1]!.y)
  expect(new Set(capacitorRailYs)).toEqual(new Set([firstCapacitorRailY]))
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
