import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260728T225606Z/bug-report-20260728T225606Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
