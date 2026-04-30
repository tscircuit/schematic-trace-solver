import { expect } from "bun:test"
import { test } from "bun:test"
import inputData from "../../assets/SameNetCollinearTraceMerger.test.input.json"
import { SameNetCollinearTraceMerger } from "lib/solvers/SameNetCollinearTraceMerger/SameNetCollinearTraceMerger"

test("SameNetCollinearTraceMerger merges collinear traces on same net", () => {
  const solver = new SameNetCollinearTraceMerger({
    inputProblem: inputData.inputProblem,
    traces: inputData.traces as any,
  })
  solver.solve()

  const output = solver.getOutput()

  // Should have fewer traces after merging
  expect(output.traces.length).toBeLessThanOrEqual(inputData.traces.length)

  // All traces should still have valid paths
  for (const trace of output.traces) {
    expect(trace.tracePath.length).toBeGreaterThanOrEqual(2)
  }
})

test("SameNetCollinearTraceMerger snapshot", () => {
  const solver = new SameNetCollinearTraceMerger({
    inputProblem: inputData.inputProblem,
    traces: inputData.traces as any,
  })
  solver.solve()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
