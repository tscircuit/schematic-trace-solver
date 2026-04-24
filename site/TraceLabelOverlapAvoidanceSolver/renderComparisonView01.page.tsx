import { useMemo } from "react"
import { InteractiveGraphics } from "graphics-debug/react"
import { stackGraphicsHorizontally } from "graphics-debug"
import { NetLabelPlacementSolver } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { MergedNetLabelObstacleSolver } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/LabelMergingSolver/LabelMergingSolver"
import inputData from "../../tests/assets/1.input.json"

export default () => {
  const graphics = useMemo(() => {
    const mergedNetLabelObstacleSolver = new MergedNetLabelObstacleSolver(
      inputData.mergedNetLabelObstacleSolver as any,
    )
    const netLabelPlacementSolver = new NetLabelPlacementSolver(
      inputData.netLabelPlacementSolver as any,
    )

    mergedNetLabelObstacleSolver.solve()
    netLabelPlacementSolver.solve()

    return stackGraphicsHorizontally(
      [
        netLabelPlacementSolver.visualize(),
        mergedNetLabelObstacleSolver.visualize(),
      ],
      {
        titles: ["NetLabelPlacementSolver", "MergedNetLabelObstacles"],
      },
    )
  }, [])

  return <InteractiveGraphics graphics={graphics} />
}
