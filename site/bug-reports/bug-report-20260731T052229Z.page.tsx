import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260731T052229Z/bug-report-20260731T052229Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
