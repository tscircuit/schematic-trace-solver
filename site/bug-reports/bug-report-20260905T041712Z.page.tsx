import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260905T041712Z/bug-report-20260905T041712Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
