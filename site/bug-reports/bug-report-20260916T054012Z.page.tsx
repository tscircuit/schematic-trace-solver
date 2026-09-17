import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260916T054012Z/bug-report-20260916T054012Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
