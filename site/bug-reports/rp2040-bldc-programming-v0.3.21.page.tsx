import type { InputProblem } from "lib/types/InputProblem"
import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/repros/rp2040-bldc-programming-v0.3.21/programming.input.json"

export default () => (
  <PipelineDebugger inputProblem={inputProblem as InputProblem} hideRatsNet />
)
