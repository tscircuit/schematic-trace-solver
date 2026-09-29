import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../assets/example49.json"
import "tests/fixtures/matcher"

test("example49", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const { outputTraces: traces, outputNetLabelPlacements: labels } =
    solver.netLabelToTraceSolver!
  const label = labels.find(
    (label) => label.netId === "CSN" && label.pinIds.includes("U4.7"),
  )!
  const connector = traces.find(
    (trace) =>
      trace.globalConnNetId === label.globalConnNetId &&
      solver.availableNetOrientationSolver!.netLabelConnectorTraceIds.has(
        trace.mspPairId,
      ),
  )!
  expect(connector.tracePath.at(-1)!.x).toBeCloseTo(label.anchorPoint.x)
  expect(connector.tracePath.at(-1)!.y).toBeCloseTo(label.anchorPoint.y)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
