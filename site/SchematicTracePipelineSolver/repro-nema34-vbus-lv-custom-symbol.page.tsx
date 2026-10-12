import { PipelineDebugger } from "site/components/PipelineDebugger"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "../../tests/repros/assets/repro-nema34-vbus-lv-custom-symbol.input.json"

export default () => (
  <PipelineDebugger inputProblem={inputProblem as InputProblem} />
)
