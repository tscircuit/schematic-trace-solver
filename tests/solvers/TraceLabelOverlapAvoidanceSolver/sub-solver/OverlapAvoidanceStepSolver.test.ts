import { OverlapAvoidanceStepSolver } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/OverlapAvoidanceStepSolver/OverlapAvoidanceStepSolver"
import { expect } from "bun:test"
import { test } from "bun:test"
import inputData from "../../../assets/OverlapAvoidanceStepSolver.test.input.json"

test("OverlapAvoidanceStepSolver snapshot", () => {
  const solver = new OverlapAvoidanceStepSolver({
    inputProblem: inputData.problem as any,
    traces: inputData.traces as any,
    netLabelPlacements: inputData.netLabelPlacements as any,
    mergedLabelNetIdMap: Object.fromEntries(
      Object.entries(inputData.mergedLabelNetIdMap).map(([k, v]) => [
        k,
        new Set(v as any),
      ]),
    ),
  } as any)
  solver.solve()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
