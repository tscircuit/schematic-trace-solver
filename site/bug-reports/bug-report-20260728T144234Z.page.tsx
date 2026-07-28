import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260728T144234Z/bug-report-20260728T144234Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
