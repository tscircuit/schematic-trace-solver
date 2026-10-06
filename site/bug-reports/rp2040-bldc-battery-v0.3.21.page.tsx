import type { InputProblem } from "lib/types/InputProblem"
import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/repros/rp2040-bldc-battery-v0.3.21/battery.input.json"

export default () => (
  <PipelineDebugger inputProblem={inputProblem as InputProblem} hideRatsNet />
)
