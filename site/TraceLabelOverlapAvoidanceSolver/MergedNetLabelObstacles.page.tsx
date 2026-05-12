import { useMemo } from "react"
import { GenericSolverDebugger } from "site/components/GenericSolverDebugger"
import { MergedNetLabelObstacleSolver } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/LabelMergingSolver/LabelMergingSolver"
import inputData from "../../tests/assets/MergedNetLabelObstacles.test.input.json"

export default () => {
  const solver = useMemo(
    () =>
      new MergedNetLabelObstacleSolver({
        netLabelPlacements: inputData.netLabelPlacements as any,
        inputProblem: inputData.inputProblem as any,
        traces: inputData.traces as any,
      }),
    [],
  )

  return <GenericSolverDebugger solver={solver} />
}
