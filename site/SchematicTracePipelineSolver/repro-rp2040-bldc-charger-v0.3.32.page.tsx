import type { InputProblem } from "lib/types/InputProblem"
import { PipelineDebugger } from "site/components/PipelineDebugger"
import input from "../../tests/repros/assets/repro-rp2040-bldc-charger-v0.3.32.input.json"

export default () => (
  <PipelineDebugger
    inputProblem={input as unknown as InputProblem}
    hideRatsNet
  />
)
