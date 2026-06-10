import { expect, test } from "bun:test"
import inputData from "./assets/repro-same-net-trace-merging.input.json"
import { TraceCleanupSolver } from "lib/solvers/TraceCleanupSolver/TraceCleanupSolver"

test("same-net trace merging", () => {
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
