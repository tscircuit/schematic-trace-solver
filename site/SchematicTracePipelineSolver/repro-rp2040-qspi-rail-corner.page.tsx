import type { InputProblem } from "lib/types/InputProblem"
import { PipelineDebugger } from "site/components/PipelineDebugger"
import input from "../../tests/repros/assets/repro-rp2040-qspi-rail-corner.input.json"

export default () => (
  <PipelineDebugger inputProblem={input as unknown as InputProblem} />
)
