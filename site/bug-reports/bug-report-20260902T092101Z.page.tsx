import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260902T092101Z/bug-report-20260902T092101Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
