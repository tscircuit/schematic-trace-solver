import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260825T045913Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260825T045913Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const u1SwGlobalNetId =
    solver.mspConnectionPairSolver!.globalConnMap.getNetConnectedToId("U1_SW")
  const u1SwTraceMinY = Math.min(
    ...solver
      .schematicTraceLinesSolver!.solvedTracePaths.filter(
        (trace) => trace.globalConnNetId === u1SwGlobalNetId,
      )
      .flatMap((trace) => trace.tracePath.map((point) => point.y)),
  )
  expect(u1SwTraceMinY).toBe(1.1)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
