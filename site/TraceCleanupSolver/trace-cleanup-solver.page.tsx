import { TraceCleanupSolver } from "lib/solvers/TraceCleanupSolver/TraceCleanupSolver"
import { useMemo } from "react"
import { GenericSolverDebugger } from "site/components/GenericSolverDebugger"
import inputData from "../../tests/assets/TraceCleanupSolver.test.input.json"

export default () => {
  const solver = useMemo(
    () =>
      new TraceCleanupSolver({
        ...inputData,
        targetTraceIds: new Set(inputData.targetTraceIds),
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
