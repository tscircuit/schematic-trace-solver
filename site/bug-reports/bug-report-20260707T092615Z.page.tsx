import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260707T092615Z/bug-report-20260707T092615Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
