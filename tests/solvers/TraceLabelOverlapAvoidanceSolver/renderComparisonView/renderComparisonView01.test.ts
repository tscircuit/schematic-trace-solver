import { MergedNetLabelObstacleSolver } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/LabelMergingSolver/LabelMergingSolver"
import { expect } from "bun:test"
import { test } from "bun:test"
import {
  getSvgFromGraphicsObject,
  stackGraphicsHorizontally,
} from "graphics-debug"
import { NetLabelPlacementSolver } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import inputData from "../../../assets/1.input.json"

test("NetLabelPlacementSolver-to-MergedNetLabelObstacles snapshot", () => {
  const solver1 = new MergedNetLabelObstacleSolver(
    inputData.mergedNetLabelObstacleSolver as any,
  )
  const solver2 = new NetLabelPlacementSolver(
    inputData.netLabelPlacementSolver as any,
  )
  solver1.solve()
  solver2.solve()
  const sideBySide = getSvgFromGraphicsObject(
    stackGraphicsHorizontally([solver2.visualize(), solver1.visualize()], {
      titles: ["NetLabelPlacementSolver", "MergedNetLabelObstacles"],
    }),
    {
      backgroundColor: "white",
    },
  )
  expect(sideBySide).toMatchSvgSnapshot(import.meta.path)
})
