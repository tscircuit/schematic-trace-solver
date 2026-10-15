import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260909T042718Z/bug-report-20260909T042718Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
