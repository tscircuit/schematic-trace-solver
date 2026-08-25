import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260825T103621Z/bug-report-20260825T103621Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
