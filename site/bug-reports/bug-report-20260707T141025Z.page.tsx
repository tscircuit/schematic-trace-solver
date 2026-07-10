import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260707T141025Z/bug-report-20260707T141025Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
