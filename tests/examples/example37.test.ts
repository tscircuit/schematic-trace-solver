import { expect, test } from "bun:test"
import { countCrossingsWithOtherTraces } from "lib/solvers/Example28Solver/countCrossingsWithOtherTraces"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../assets/example37.json"
import "tests/fixtures/matcher"

test("example37", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const traces = solver.netLabelToTraceSolver!.getOutput().traces
  const recoveredTrace = traces.find(
    (trace) => trace.mspPairId === "net-label-to-trace-R1.2--U1.2",
  )!

  expect(
    countCrossingsWithOtherTraces({
      trace: recoveredTrace,
      outputTraces: traces,
    }),
  ).toBe(1)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
