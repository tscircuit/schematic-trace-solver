import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260708T055430Z/bug-report-20260708T055430Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
