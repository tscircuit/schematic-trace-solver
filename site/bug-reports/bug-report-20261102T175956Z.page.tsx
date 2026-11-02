import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20261102T175956Z/bug-report-20261102T175956Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
