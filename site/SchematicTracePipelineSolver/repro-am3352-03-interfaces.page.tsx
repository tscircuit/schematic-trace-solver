import type { InputProblem } from "lib/types/InputProblem"
import { PipelineDebugger } from "site/components/PipelineDebugger"
import input from "../../tests/repros/assets/repro-am3352-03-interfaces.input.json"

export default () => (
  <PipelineDebugger inputProblem={structuredClone(input) as InputProblem} />
)
