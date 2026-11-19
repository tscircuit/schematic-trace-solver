import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20261119T082622Z/bug-report-20261119T082622Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
