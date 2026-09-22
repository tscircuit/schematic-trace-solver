import {
  NetLabelNetLabelCollisionSolver,
  type NetLabelNetLabelCollisionSolverParams,
} from "lib/solvers/NetLabelNetLabelCollisionSolver/NetLabelNetLabelCollisionSolver"
import { useMemo } from "react"
import { GenericSolverDebugger } from "site/components/GenericSolverDebugger"
import input from "../../tests/repros/assets/repro-rp2040-nema23-dangling-v3v3-connector.input.json"

export default () => {
  const solver = useMemo(
    () =>
      new NetLabelNetLabelCollisionSolver(
        structuredClone(
          input,
        ) as unknown as NetLabelNetLabelCollisionSolverParams,
      ),
    [],
  )
  return <GenericSolverDebugger solver={solver} />
}
