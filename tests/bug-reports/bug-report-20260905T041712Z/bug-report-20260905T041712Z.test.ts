import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { getPathLength } from "lib/solvers/Example28Solver/geometry"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "./bug-report-20260905T041712Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260905T041712Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)

  solver.solve()

  expect(solver.solved).toBe(true)
  for (const mspPairId of [
    "schematic_port_98-schematic_port_123",
    "schematic_port_101-schematic_port_125",
  ]) {
    const recoveredTrace =
      solver.unroutedTraceRecoverySolver!.solvedUnroutedTraces.find(
        (trace) => trace.mspPairId === mspPairId,
      )
    expect(recoveredTrace).toBeDefined()
    expect(getPathLength(recoveredTrace!.tracePath)).toBeCloseTo(0.8)

    const finalTrace = solver
      .netLabelToTraceSolver!.getOutput()
      .traces.find((trace) => trace.mspPairId === mspPairId)
    expect(finalTrace).toBeDefined()
    expect(getPathLength(finalTrace!.tracePath)).toBeCloseTo(0.8)
  }

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
