import { PipelineDebugger } from "site/components/PipelineDebugger"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "../../tests/repros/assets/repro-rp2040-shaft-position.input.json"

export default () => (
  <PipelineDebugger inputProblem={inputProblem as unknown as InputProblem} />
)
