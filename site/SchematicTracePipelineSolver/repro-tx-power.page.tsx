import type { InputProblem } from "lib/types/InputProblem"
import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblemJson from "../../tests/repros/assets/repro-tx-power.input.json"

export default () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  return <PipelineDebugger inputProblem={inputProblem} />
}
