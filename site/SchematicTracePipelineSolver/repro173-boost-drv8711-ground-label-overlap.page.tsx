import type { InputProblem } from "lib/types/InputProblem"
import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/repros/assets/repro173-boost-drv8711-ground-label-overlap.input.json"

export default () => (
  <PipelineDebugger inputProblem={inputProblem as unknown as InputProblem} />
)
