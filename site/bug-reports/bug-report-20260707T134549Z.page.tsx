import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260707T134549Z/bug-report-20260707T134549Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
