import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { getPathLength } from "lib/solvers/Example28Solver/geometry"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-schematic-section-autolayout-no-section.input.json"

// Exact solver:started input from tscircuit/core at b198cb4116f55a10d5ce709c5c99ecb73799f41e:
// tests/components/primitive-components/schematic-section-autolayout-no-section.test.tsx.
test("repro schematic sections with unsectioned output components", async () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)
  solver.solve()

  const recoveredSupplyTrace = solver
    .unroutedTraceRecoverySolver!.getOutput()
    .newTraces.find((trace) => trace.pinIds.includes("schematic_port_11"))!
  const existingSupplyTrace = solver
    .longDistancePairSolver!.getOutput()
    .allTracesMerged.find((trace) => trace.pinIds.includes("schematic_port_9"))!
  expect(recoveredSupplyTrace.tracePath).toHaveLength(4)
  expect(getPathLength(recoveredSupplyTrace.tracePath)).toBeCloseTo(2.1275)
  expect(
    tracePathContainsPoint(
      existingSupplyTrace.tracePath,
      recoveredSupplyTrace.tracePath.at(-1)!,
    ),
  ).toBe(true)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
