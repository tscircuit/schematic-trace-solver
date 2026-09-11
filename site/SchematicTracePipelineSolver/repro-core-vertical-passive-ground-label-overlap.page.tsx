import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/repros/assets/repro-core-vertical-passive-ground-label-overlap.input.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
