import { expect, test } from "bun:test"
import { MergedNetLabelObstacleSolver } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/LabelMergingSolver/LabelMergingSolver"
import inputData from "../../../assets/MergedNetLabelObstacles.test.input.json"

test("LabelMergingSolver snapshot", () => {
  const solver = new MergedNetLabelObstacleSolver({
    netLabelPlacements: inputData.netLabelPlacements as any,
    inputProblem: inputData.inputProblem as any,
    traces: inputData.traces as any,
  })
  solver.solve()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
