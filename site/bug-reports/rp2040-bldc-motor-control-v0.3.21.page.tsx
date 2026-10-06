import type { InputProblem } from "lib/types/InputProblem"
import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/repros/rp2040-bldc-motor-control-v0.3.21/motor-control.input.json"

export default () => (
  <PipelineDebugger
    inputProblem={inputProblem as unknown as InputProblem}
    hideRatsNet
  />
)
