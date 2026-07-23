import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260716T144856Z/bug-report-20260716T144856Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
