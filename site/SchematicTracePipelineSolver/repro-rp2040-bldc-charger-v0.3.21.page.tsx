import type { InputProblem } from "lib/types/InputProblem"
import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/repros/assets/repro-rp2040-bldc-charger-v0.3.21.input.json"

export default () => (
  <PipelineDebugger inputProblem={inputProblem as InputProblem} hideRatsNet />
)
