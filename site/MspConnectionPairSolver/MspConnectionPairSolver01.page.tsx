import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { useMemo } from "react"
import { GenericSolverDebugger } from "site/components/GenericSolverDebugger"
import inputParams from "./MspConnectionPairSolver01_params.json"

export default () => {
  const solver = useMemo(
    () =>
      new MspConnectionPairSolver({
        inputProblem: inputParams.inputProblem as unknown as InputProblem,
      }),
    [],
  )
  return <GenericSolverDebugger solver={solver} />
}
