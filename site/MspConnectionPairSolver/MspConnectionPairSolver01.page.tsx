import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import inputParams from "./MspConnectionPairSolver01_params.json"
import { GenericSolverDebugger } from "site/components/GenericSolverDebugger"
import { useMemo } from "react"
import type { InputProblem } from "lib/types/InputProblem"

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
