import { useMemo } from "react"
import { GenericSolverDebugger } from "site/components/GenericSolverDebugger"
import { InlineNetLabelSolver } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import { getShaftPositionLabelClearanceInput } from "../../tests/repros/assets/repro-rp2040-shaft-position-label-clearance.input"

export default () => {
  const solver = useMemo(
    () => new InlineNetLabelSolver(getShaftPositionLabelClearanceInput()),
    [],
  )
  return <GenericSolverDebugger solver={solver} />
}
