import { PipelineDebugger } from "site/components/PipelineDebugger"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "../../tests/repros/assets/repro-kicad-bga381-inline-refinement.input.json"

export default () => (
  <PipelineDebugger inputProblem={inputProblem as InputProblem} hideRatsNet />
)
