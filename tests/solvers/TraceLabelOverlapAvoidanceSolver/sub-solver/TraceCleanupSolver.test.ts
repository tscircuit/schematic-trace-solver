import { expect } from "bun:test"
import { test } from "bun:test"
import { TraceCleanupSolver } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/TraceCleanupSolver/TraceCleanupSolver"
import inputData from "../../../assets/TraceCleanupSolver.test.input.json"

test("TraceCleanupSolver snapshot", () => {
  const solver = new TraceCleanupSolver({
    ...inputData,
    targetTraceIds: new Set(inputData.targetTraceIds),
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
