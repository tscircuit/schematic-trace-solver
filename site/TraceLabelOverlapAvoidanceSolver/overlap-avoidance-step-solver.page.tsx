import { OverlapAvoidanceStepSolver } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/OverlapAvoidanceStepSolver/OverlapAvoidanceStepSolver"
import { useMemo } from "react"
import { GenericSolverDebugger } from "site/components/GenericSolverDebugger"
import inputData from "../../tests/assets/OverlapAvoidanceStepSolver.test.input.json"

export default () => {
  const solver = useMemo(
    () =>
      new OverlapAvoidanceStepSolver({
        inputProblem: inputData.problem as any,
        traces: inputData.traces as any,
        netLabelPlacements: inputData.netLabelPlacements as any,
        mergedLabelNetIdMap: Object.fromEntries(
          Object.entries(inputData.mergedLabelNetIdMap).map(([k, v]) => [
            k,
            new Set(v as any),
          ]),
        ),
      } as any),
    [],
  )

  return <GenericSolverDebugger solver={solver} />
}
