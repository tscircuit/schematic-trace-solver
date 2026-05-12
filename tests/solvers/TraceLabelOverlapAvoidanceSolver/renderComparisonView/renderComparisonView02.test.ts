import { MergedNetLabelObstacleSolver } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/LabelMergingSolver/LabelMergingSolver"
import { expect } from "bun:test"
import { test } from "bun:test"
import {
  getSvgFromGraphicsObject,
  stackGraphicsHorizontally,
} from "graphics-debug"
import { SingleOverlapSolver } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/SingleOverlapSolver/SingleOverlapSolver"
import inputData from "../../../assets/2.input.json"

test("MergedNetLabelObstaclesSolver-to-SingleOverlapSolver snapshot", () => {
  const solver1 = new MergedNetLabelObstacleSolver(
    inputData.mergedNetLabelObstacleSolver as any,
  )
  const solver2 = new SingleOverlapSolver(inputData.singleOverlapSolver as any)
  solver1.solve()
  solver2.solve()
  const sideBySide = getSvgFromGraphicsObject(
    stackGraphicsHorizontally([solver1.visualize(), solver2.visualize()], {
      titles: ["MergedNetLabelObstaclesSolver", "SingleOverlapSolver"],
    }),
    {
      backgroundColor: "white",
    },
  )
  expect(sideBySide).toMatchSvgSnapshot(import.meta.path)
})
