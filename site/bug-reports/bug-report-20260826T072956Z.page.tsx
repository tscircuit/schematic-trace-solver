import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260826T072956Z/bug-report-20260826T072956Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
