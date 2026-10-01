import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20261001T055134Z/bug-report-20261001T055134Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
