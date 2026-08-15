import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260815T073240Z/bug-report-20260815T073240Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
