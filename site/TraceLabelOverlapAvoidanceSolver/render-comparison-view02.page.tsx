import { stackGraphicsHorizontally } from "graphics-debug"
import { InteractiveGraphics } from "graphics-debug/react"
import { MergedNetLabelObstacleSolver } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/LabelMergingSolver/label-merging-solver"
import { SingleOverlapSolver } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/SingleOverlapSolver/SingleOverlapSolver"
import { useMemo } from "react"
import inputData from "../../tests/assets/2.input.json"

export default () => {
  const graphics = useMemo(() => {
    const mergedNetLabelObstacleSolver = new MergedNetLabelObstacleSolver(
      inputData.mergedNetLabelObstacleSolver as any,
    )
    const singleOverlapSolver = new SingleOverlapSolver(
      inputData.singleOverlapSolver as any,
    )

    mergedNetLabelObstacleSolver.solve()
    singleOverlapSolver.solve()

    return stackGraphicsHorizontally(
      [
        mergedNetLabelObstacleSolver.visualize(),
        singleOverlapSolver.visualize(),
      ],
      {
        titles: ["MergedNetLabelObstaclesSolver", "SingleOverlapSolver"],
      },
    )
  }, [])

  return <InteractiveGraphics graphics={graphics} />
}
