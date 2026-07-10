import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260708T053736Z/bug-report-20260708T053736Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
