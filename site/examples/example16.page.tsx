import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../assets/example16.json"

export { inputProblem }

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
