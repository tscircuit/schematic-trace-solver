import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/assets/enc-scl-hop.json"

export default () => (
  <PipelineDebugger inputProblem={inputProblem as any} hideRatsNet />
)
