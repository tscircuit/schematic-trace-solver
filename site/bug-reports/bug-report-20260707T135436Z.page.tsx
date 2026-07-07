import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260707T135436Z/bug-report-20260707T135436Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
