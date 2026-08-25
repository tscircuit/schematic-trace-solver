import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../../assets/inline-net-label-anchored-label-clearance.json"
import "tests/fixtures/matcher"

test("regular labels are drawn beyond adjacent inline labels", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const output = solver.inlineNetLabelSolver!.getOutput()
  const regularLabels = output.netLabelPlacements.filter((label) =>
    ["D_MINUS", "D_PLUS"].includes(label.netId ?? ""),
  )
  expect(solver.inlineNetLabelSolver!.stats.pushedAnchoredNetLabelCount).toBe(2)
  expect(regularLabels).toHaveLength(2)
  expect(regularLabels[0]!.anchorPoint.x).toBeCloseTo(
    regularLabels[1]!.anchorPoint.x,
  )
  expect(regularLabels[0]!.anchorPoint.x).toBeLessThan(-0.7)
  expect(
    output.traces.filter((trace) =>
      trace.mspPairId.startsWith("inline-net-label-clearance-"),
    ),
  ).toHaveLength(2)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
