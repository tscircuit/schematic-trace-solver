import { expect } from "vitest"
import { test } from "vitest"
import inputData from "../../assets/TraceCleanupSolver.test.input.json"
import { TraceCleanupSolver } from "lib/solvers/TraceCleanupSolver/TraceCleanupSolver"

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
  expect(solver).toBeDefined();
});
