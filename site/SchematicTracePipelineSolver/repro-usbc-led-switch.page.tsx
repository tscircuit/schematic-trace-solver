import type { InputProblem } from "lib/types/InputProblem"
import { PipelineDebugger } from "site/components/PipelineDebugger"
import input from "../../tests/repros/assets/repro-usbc-led-switch.input.json"

export default () => (
  <PipelineDebugger inputProblem={input as unknown as InputProblem} />
)
