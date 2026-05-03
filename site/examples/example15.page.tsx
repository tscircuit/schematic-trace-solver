import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/assets/example15.json"

export { inputProblem }

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
