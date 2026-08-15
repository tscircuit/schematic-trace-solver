import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260815T073344Z/bug-report-20260815T073344Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
