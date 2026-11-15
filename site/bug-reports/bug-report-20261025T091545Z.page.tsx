import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20261025T091545Z/bug-report-20261025T091545Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
