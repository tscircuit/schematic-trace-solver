import { useMemo } from "react"
import { GenericSolverDebugger } from "site/components/GenericSolverDebugger"
import { CombineCloseTraceSegmentsSolver } from "lib/solvers/CombineCloseTraceSegmentsSolver/CombineCloseTraceSegmentsSolver"
import inputData from "../../tests/assets/CombineCloseTraceSegmentsSolver.test.input.json"

export default () => {
  const solver = useMemo(
    () => new CombineCloseTraceSegmentsSolver(inputData as any),
    [],
  )
  return <GenericSolverDebugger solver={solver} />
}
