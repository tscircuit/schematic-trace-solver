import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260728T144234Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260728T144234Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const leftmostV3v3Trace =
    solver.sameNetJunctionAlignmentSolver!.outputTraces.find(
      (trace) => trace.mspPairId === "schematic_port_34-schematic_port_33",
    )!
  expect(leftmostV3v3Trace.tracePath[1]!.y).toBeCloseTo(-2.365)
  expect(leftmostV3v3Trace.tracePath[2]!.y).toBeCloseTo(-2.365)
  expect(leftmostV3v3Trace.tracePath).toHaveLength(3)
  expect(leftmostV3v3Trace.tracePath.at(-1)!.y).toBeCloseTo(-2.365)
  for (const trace of solver.netLabelToTraceSolver!.getOutput().traces) {
    const length = trace.tracePath
      .slice(1)
      .reduce(
        (sum, pt, idx) =>
          sum +
          Math.abs(pt.x - trace.tracePath[idx]!.x) +
          Math.abs(pt.y - trace.tracePath[idx]!.y),
        0,
      )
    expect(length).toBeGreaterThan(1e-6)
  }
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
