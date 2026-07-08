import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260707T230831Z/bug-report-20260707T230831Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
