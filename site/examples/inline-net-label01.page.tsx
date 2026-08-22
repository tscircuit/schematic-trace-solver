import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/assets/inline-net-label01.json"

export { inputProblem }

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
