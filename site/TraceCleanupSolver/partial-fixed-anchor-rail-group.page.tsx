import { useMemo } from "react"
import { GenericSolverDebugger } from "site/components/GenericSolverDebugger"
import { TraceCleanupSolver } from "lib/solvers/TraceCleanupSolver/TraceCleanupSolver"
import {
  problem,
  getTraces,
  labels,
} from "tests/solvers/TraceCleanupSolver/fixtures/partialRailGroup"

export default () => {
  const solver = useMemo(
    () =>
      new TraceCleanupSolver({
        inputProblem: problem,
        allTraces: getTraces(),
        allLabelPlacements: labels,
        mergedLabelNetIdMap: {},
        paddingBuffer: 0.1,
        operations: ["aligning_same_net_rails"],
      }),
    [],
  )
  return <GenericSolverDebugger solver={solver} />
}
