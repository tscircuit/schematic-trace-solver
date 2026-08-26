import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "tests/assets/audio-amplifier-tas2505.input.json"
import "tests/fixtures/matcher"

test("repro AudioAmplifier TAS2505 schematic traces", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const capacitorRailTraceIds = new Set([
    "schematic_port_32-schematic_port_30",
    "schematic_port_5-schematic_port_32",
    "schematic_port_7-schematic_port_5",
    "schematic_port_10-schematic_port_7",
    "schematic_port_34-schematic_port_10",
    "schematic_port_36-schematic_port_34",
  ])
  const capacitorRailYs = solver
    .inlineNetLabelSolver!.getOutput()
    .traces.filter((trace) => capacitorRailTraceIds.has(trace.mspPairId))
    .map((trace) => trace.tracePath[1]!.y)
  expect(new Set(capacitorRailYs)).toEqual(new Set([5.92]))
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
