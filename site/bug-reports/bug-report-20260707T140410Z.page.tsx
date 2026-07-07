import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260707T140410Z/bug-report-20260707T140410Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
