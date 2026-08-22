import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260717T022934Z/bug-report-20260717T022934Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
