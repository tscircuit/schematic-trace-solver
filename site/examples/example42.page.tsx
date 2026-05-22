import { useMemo } from "react"
import { SameNetTraceConsolidationSolver } from "lib/solvers/SameNetTraceConsolidationSolver/SameNetTraceConsolidationSolver"
import { GenericSolverDebugger } from "site/components/GenericSolverDebugger"
import inputData from "../../tests/assets/example42.json"

export default () => {
  const solver = useMemo(
    () => new SameNetTraceConsolidationSolver(inputData as any),
    [],
  )

  return <GenericSolverDebugger solver={solver} />
}
