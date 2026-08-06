import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260806T071534Z/bug-report-20260806T071534Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
