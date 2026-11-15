import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20261008T065935Z/bug-report-20261008T065935Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
