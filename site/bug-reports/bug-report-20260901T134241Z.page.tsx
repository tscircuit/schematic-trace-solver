import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260901T134241Z/bug-report-20260901T134241Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
