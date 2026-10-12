import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20261012T065717Z/bug-report-20261012T065717Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
