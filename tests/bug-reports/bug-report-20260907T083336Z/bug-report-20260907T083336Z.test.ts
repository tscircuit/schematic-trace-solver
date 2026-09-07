import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260907T083336Z.json"
import "tests/fixtures/matcher"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { InputProblem } from "lib/types/InputProblem"

test("bug-report-20260907T083336Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)

  solver.solve()

  expect(solver.solved).toBe(true)
  const traces = solver.netLabelToTraceSolver!.getOutput().traces
  const r6 = traces.find(
    (trace) => trace.mspPairId === "schematic_port_134-schematic_port_120",
  )!
  const capacitorRail = traces.find(
    (trace) => trace.mspPairId === "schematic_port_132-schematic_port_134",
  )!
  expect(
    tracePathContainsPoint(capacitorRail.tracePath, r6.tracePath.at(-1)!),
  ).toBe(true)
  expect(r6.tracePath.at(-1)!.y).toBeCloseTo(-3.135)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
