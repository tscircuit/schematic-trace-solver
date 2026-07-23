import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260721T221026Z/bug-report-20260721T221026Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
