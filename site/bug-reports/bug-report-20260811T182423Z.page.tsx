import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260811T182423Z/bug-report-20260811T182423Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
