import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../assets/example49.json"
import "tests/fixtures/matcher"

test("example49", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const originalLabel = solver
    .netLabelNetLabelCollisionSolver!.getOutput()
    .netLabelPlacements.find(
      (label) => label.netId === "CSN" && label.pinIds.includes("U4.7"),
    )!
  const { traces, netLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()
  const label = netLabelPlacements.find(
    (label) =>
      label.netId === originalLabel.netId && label.pinIds.includes("U4.7"),
  )!
  const connector = traces.find(
    (trace) =>
      trace.globalConnNetId === label.globalConnNetId &&
      solver.availableNetOrientationSolver!.netLabelConnectorTraceIds.has(
        trace.mspPairId,
      ),
  )!
  expect(label).toEqual(originalLabel)
  expect(connector).toEqual(
    solver.netLabelNetLabelCollisionSolver!.traces.find(
      (trace) => trace.mspPairId === connector.mspPairId,
    )!,
  )
  expect(connector.tracePath.at(-1)).toEqual(label.anchorPoint)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
