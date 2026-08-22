import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260806T093501Z/bug-report-20260806T093501Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
