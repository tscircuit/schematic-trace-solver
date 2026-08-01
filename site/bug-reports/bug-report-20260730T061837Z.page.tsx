import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260730T061837Z/bug-report-20260730T061837Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
