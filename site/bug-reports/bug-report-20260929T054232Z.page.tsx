import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260929T054232Z/bug-report-20260929T054232Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
